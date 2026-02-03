const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

app.use(express.static("public"));

io.on("connection", socket => {

    socket.on("join-room", roomId => {
        socket.join(roomId);

        const clients = io.sockets.adapter.rooms.get(roomId);

        if (clients.size === 2) {
            socket.to(roomId).emit("ready");
        }
    });

    socket.on("offer", data => {
        socket.to(data.room).emit("offer", data.offer);
    });

    socket.on("answer", data => {
        socket.to(data.room).emit("answer", data.answer);
    });

    socket.on("ice-candidate", data => {
        socket.to(data.room).emit("ice-candidate", data.candidate);
    });

    socket.on("leave-room", room => {
        socket.leave(room);
        socket.to(room).emit("call-ended");
    });
});

server.listen(PORT, () => {
    console.log("Server running on port", PORT);
});
