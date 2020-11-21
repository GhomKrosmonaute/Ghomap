const serveStatic = require("serve-static")
const http = require("http")
const final = require("finalhandler")

// Serve up public/ftp folder
const serve = serveStatic("./docs", { index: 'index.html' })

// Create server
const server = http.createServer(function onRequest (req, res) {
  serve(req, res, final(req, res))
})

// Listen
server.listen(4224)