import os, http.server, socketserver

class CustomHandler(http.server.SimpleHTTPRequestHandler):
    def translate_path(self, path):
        path = super().translate_path(path)
        if os.path.isdir(path):
            default = os.path.join(path, "index.html")
            if os.path.exists(default):
                return default
        return path

    def end_headers(self):
        # TWO caches are in play, and only the HTTP cache is controlled here.
        # The Service Worker cache (in sw.js) is the offline lifeline: it
        # pre-caches the shell on install and keeps it in caches forever, so
        # the app loads fully even when this server is dead. These headers do
        # NOT touch that — they only decide whether the browser re-checks
        # the network before the SW ever runs.
        #
        #   sw.js       → no-store : the update check always fetches fresh bytes,
        #                            so a version bump is detected immediately.
        #                            Does not weaken the SW cache in any way.
        #   index.html  → no-cache : network-first (revalidate), but still served
        #                            from the SW cache when the network is down.
        #   icons       → long-lived: static, versioned via the CACHE_NAME bump.
        path = self.translate_path(self.path)
        fname = os.path.basename(path).lower()
        if fname == 'sw.js':
            self.send_header('Cache-Control', 'no-store, must-revalidate')
        elif fname in ('index.html', 'manifest.json'):
            self.send_header('Cache-Control', 'no-cache, must-revalidate')
        else:
            # everything else (icons, css, js, images): heuristic cache freely.
            # the SW's network-first handler already updates these on the next
            # successful fetch; offline they come from the SW cache.
            self.send_header('Cache-Control', 'public, max-age=31536000')
        super().end_headers()

socketserver.TCPServer.allow_reuse_address = True
with socketserver.TCPServer(("", 8080), CustomHandler) as httpd:
    httpd.serve_forever()
