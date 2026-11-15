"""Static preview files with single byte ranges for native media playback."""
import datetime
import email.utils
import http.server
import os
from pathlib import Path
import re


class RangeRequestHandler(http.server.SimpleHTTPRequestHandler):
    extensions_map = {**http.server.SimpleHTTPRequestHandler.extensions_map, ".mobileconfig": "application/x-apple-aspen-config"}

    """Keep the normal file server, adding bounded GET/HEAD media ranges.

    The configured directory is the only served tree, including when a file is
    a symlink. Multiple ranges are deliberately unsupported rather than building
    an unbounded multipart response for this small local preview.
    """

    def end_headers(self):
        self.send_header('Accept-Ranges', 'bytes')
        super().end_headers()

    def send_head(self):
        self._range_remaining = None
        path = self.translate_path(self.path)
        directory = Path(self.directory).resolve()
        try:
            Path(path).resolve().relative_to(directory)
        except (ValueError, OSError):
            self.send_error(403, 'File is outside the preview directory')
            return None
        requested = self.headers.get('Range')
        if not requested or os.path.isdir(path):
            return super().send_head()
        try:
            stream = open(path, 'rb')
        except OSError:
            self.send_error(404, 'File not found')
            return None
        try:
            stat = os.fstat(stream.fileno())
            # A changed or unrecognized If-Range validator requires the complete
            # representation. This server emits Last-Modified, not entity tags.
            validator = self.headers.get('If-Range')
            if validator:
                try:
                    date = email.utils.parsedate_to_datetime(validator)
                    if date.tzinfo is None:
                        date = date.replace(tzinfo=datetime.timezone.utc)
                    current = datetime.datetime.fromtimestamp(stat.st_mtime, datetime.timezone.utc).replace(microsecond=0)
                    matches = current <= date
                except (TypeError, ValueError, OverflowError):
                    matches = False
                if not matches:
                    stream.close()
                    return super().send_head()
            size = stat.st_size
            match = re.fullmatch(r'bytes=(\d*)-(\d*)', requested.strip())
            if len(requested) > 200 or not match or not any(match.groups()) or size == 0:
                return self._unsatisfiable(stream, size)
            first, last = match.groups()
            if first:
                start = int(first)
                end = min(int(last), size - 1) if last else size - 1
                if start >= size or end < start:
                    return self._unsatisfiable(stream, size)
            else:
                suffix = int(last)
                if suffix <= 0:
                    return self._unsatisfiable(stream, size)
                start, end = max(0, size - suffix), size - 1
            self.send_response(206)
            self.send_header('Content-Type', self.guess_type(path))
            self.send_header('Content-Range', f'bytes {start}-{end}/{size}')
            self.send_header('Content-Length', str(end - start + 1))
            self.send_header('Last-Modified', self.date_time_string(stat.st_mtime))
            self.end_headers()
            stream.seek(start)
            self._range_remaining = end - start + 1
            return stream
        except BaseException:
            stream.close()
            raise

    def _unsatisfiable(self, stream, size):
        stream.close()
        self.send_response(416)
        self.send_header('Content-Range', f'bytes */{size}')
        self.send_header('Content-Length', '0')
        self.end_headers()
        return None

    def copyfile(self, source, outputfile):
        try:
            remaining = self._range_remaining
            if remaining is None:
                return super().copyfile(source, outputfile)
            while remaining:
                block = source.read(min(64 * 1024, remaining))
                if not block:
                    break
                outputfile.write(block)
                remaining -= len(block)
        except (BrokenPipeError, ConnectionResetError):
            # Seeking and leaving a page legitimately cancel earlier media reads.
            pass
