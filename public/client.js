const socket = io();

let localStream;
let peerConnection;
let roomId;
let audioEnabled = true;
let videoEnabled = true;

let screenStream;
let isScreenSharing = false;
let callStartTime;
let timerInterval;

const localVideo = document.getElementById("localVideo");
const remoteVideo = document.getElementById("remoteVideo");

const config = {
    iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
};

navigator.mediaDevices.getUserMedia({ video: true, audio: true })
    .then(stream => {
        localStream = stream;
        localVideo.srcObject = stream;
    });

function joinRoom() {
    roomId = document.getElementById("roomInput").value;
    socket.emit("join-room", roomId);
}

function createPeerConnection() {
    peerConnection = new RTCPeerConnection(config);

    localStream.getTracks().forEach(track => {
        peerConnection.addTrack(track, localStream);
    });

    peerConnection.ontrack = e => {
        remoteVideo.srcObject = e.streams[0];
    };

    peerConnection.onicecandidate = e => {
        if (e.candidate) {
            socket.emit("ice-candidate", {
                room: roomId,
                candidate: e.candidate
            });
        }
    };
}

socket.on("ready", async () => {
    createPeerConnection();

    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);

    socket.emit("offer", { room: roomId, offer });
});

socket.on("offer", async offer => {
    createPeerConnection();

    await peerConnection.setRemoteDescription(offer);
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);

    socket.emit("answer", { room: roomId, answer });
});

socket.on("answer", async answer => {
    await peerConnection.setRemoteDescription(answer);
    startTimer();
});

socket.on("ice-candidate", async candidate => {
    await peerConnection.addIceCandidate(candidate);
});

socket.on("call-ended", () => {
    cleanup();
});

function toggleAudio() {
    audioEnabled = !audioEnabled;
    localStream.getAudioTracks()[0].enabled = audioEnabled;
}

function toggleVideo() {
    videoEnabled = !videoEnabled;
    localStream.getVideoTracks()[0].enabled = videoEnabled;
}

function endCall() {
    socket.emit("leave-room", roomId);
    cleanup();
}

function cleanup() {
    if (peerConnection) peerConnection.close();
    peerConnection = null;
    remoteVideo.srcObject = null;
}

async function toggleScreenShare() {
    if (!isScreenSharing) {
        screenStream = await navigator.mediaDevices.getDisplayMedia({
            video: true
        });

        const screenTrack = screenStream.getVideoTracks()[0];
        const sender = peerConnection
            .getSenders()
            .find(s => s.track.kind === "video");

        sender.replaceTrack(screenTrack);
        localVideo.srcObject = screenStream;

        screenTrack.onended = () => {
            stopScreenShare();
        };

        isScreenSharing = true;
    } else {
        stopScreenShare();
    }
}

function stopScreenShare() {
    const videoTrack = localStream.getVideoTracks()[0];
    const sender = peerConnection
        .getSenders()
        .find(s => s.track.kind === "video");

    sender.replaceTrack(videoTrack);
    localVideo.srcObject = localStream;
    isScreenSharing = false;
}

function startTimer() {
    callStartTime = Date.now();
    timerInterval = setInterval(() => {
        const elapsed = Math.floor((Date.now() - callStartTime) / 1000);
        document.getElementById("timer").innerText =
            new Date(elapsed * 1000).toISOString().substr(11, 8);
    }, 1000);
}

function cleanup() {
    if (peerConnection) peerConnection.close();
    peerConnection = null;
    remoteVideo.srcObject = null;
    clearInterval(timerInterval);
    document.getElementById("timer").innerText = "00:00:00";
}

