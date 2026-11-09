const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 3000;

// Verificação do servidor
app.get("/", (req, res) => {
  res.json({
    status: "online",
    game: "PENALTY FEVER",
    server: "Multiplayer",
    version: "1.0.0"
  });
});

// Salas multiplayer
const rooms = new Map();

io.on("connection", (socket) => {
  console.log("Jogador conectado:", socket.id);

  // Criar sala
  socket.on("createRoom", (data, callback) => {
    const roomCode = Math.random()
      .toString(36)
      .substring(2, 8)
      .toUpperCase();

    rooms.set(roomCode, {
      creator: socket.id,
      players: [socket.id],
      state: {}
    });

    socket.join(roomCode);

    if (typeof callback === "function") {
      callback({
        success: true,
        roomCode
      });
    }

    console.log("Sala criada:", roomCode);
  });

  // Entrar em uma sala
  socket.on("joinRoom", (roomCode, callback) => {
    const code = String(roomCode || "").toUpperCase();
    const room = rooms.get(code);

    if (!room) {
      if (typeof callback === "function") {
        callback({
          success: false,
          message: "Sala não encontrada."
        });
      }
      return;
    }

    if (room.players.length >= 16) {
      if (typeof callback === "function") {
        callback({
          success: false,
          message: "Sala cheia."
        });
      }
      return;
    }

    if (!room.players.includes(socket.id)) {
      room.players.push(socket.id);
    }

    socket.join(code);

    if (typeof callback === "function") {
      callback({
        success: true,
        roomCode: code,
        players: room.players.length
      });
    }

    io.to(code).emit("roomUpdate", {
      players: room.players.length
    });
  });

  // Sincronização de informações da sala
  socket.on("syncRoom", (data) => {
    const code = String(data?.roomCode || "").toUpperCase();
    const room = rooms.get(code);

    if (!room || !room.players.includes(socket.id)) return;

    room.state = data.state || {};

    socket.to(code).emit("roomSync", {
      state: room.state
    });
  });

  // Enviar informações para outro jogador
  socket.on("gameEvent", (data) => {
    const code = String(data?.roomCode || "").toUpperCase();
    const room = rooms.get(code);

    if (!room || !room.players.includes(socket.id)) return;

    socket.to(code).emit("gameEvent", data.event);
  });

  // Desconexão
  socket.on("disconnect", () => {
    console.log("Jogador desconectado:", socket.id);

    for (const [code, room] of rooms) {
      room.players = room.players.filter(
        player => player !== socket.id
      );

      if (room.players.length === 0) {
        rooms.delete(code);
      } else {
        io.to(code).emit("roomUpdate", {
          players: room.players.length
        });
      }
    }
  });
});

// Inicialização
server.listen(PORT, "0.0.0.0", () => {
  console.log(`PENALTY FEVER online na porta ${PORT}`);
});