// ----------------------- MAIN -----------------------
let chess = new Chess();
let amiwhite = null;
let selected_piece = null;
let connected = false;
window.onhashchange = loadFromhash;

let board = document.querySelector(".chessboard");
let cells = [[], [], [], [], [], [], [], []];
drawBoard();
loadFromhash(); //if the window was loaded with some hash
redraw();

// -------------------- FUNCTIONS ----------------------

function ij2coord(i, j) {
  return "abcdefgh"[j] + (8 - i);
}
function coord2ij(coord) {
  return [8 - parseInt(coord[1]), "abcdefgh".split("").indexOf(coord[0])];
}
function makepiece(piece, color) {
  let elem = document.createElement("img");
  elem.className = "piece";
  elem.src = `images/Chess_${piece}${color}t60.png`;
  elem.alt = `${piece}${color}`;
  elem.draggable = true;
  elem.ondragstart = function(e) {
    elem.style.transform = "scale(1.3);";
    e.dataTransfer.setData("piece", piece);
    e.dataTransfer.setData("color", color);
    e.dataTransfer.setData("from", elem.parentElement.id);
  };

  return elem;
}
function drawBoard() {
  for (let i = 0; i < 8; i++) {
    for (let j = 0; j < 8; j++) {
      let div = document.createElement("div");
      div.style.backgroundColor =
        (i + (j % 2)) % 2 ? "var(--black)" : "var(--white)";
      div.id = ij2coord(i, j);
      div.ondrop = function(e) {
        e.preventDefault();
        let piece = e.dataTransfer.getData("piece");
        let color = e.dataTransfer.getData("color");
        let from = e.dataTransfer.getData("from");
        if (piece == "p" && this.id.match(/[a-z]1?8?/) != null) {
          makemove({ from: from, to: this.id, promotion: "q" }, false);
        } else {
          makemove({ from: from, to: this.id }, false);
        }
      };
      div.ondragover = function(e) {
        e.preventDefault();
      };
      div.onclick = function(e) {
        if (selected_piece == null) {
          let piece = this.querySelector(".piece");
          if (piece != null) {
            piece.classList.add("selected-piece");
            selected_piece = piece;
          }
        } else {
          let m = makemove(
            { from: selected_piece.parentElement.id, to: this.id },
            false
          );
          selected_piece.classList.remove("selected-piece");
          selected_piece = null;
        }
      };
      board.appendChild(div);
      cells[i][j] = div;
    }
  }
}
function clearBoard() {
  for (let i = 0; i < 8; i++) {
    for (let j = 0; j < 8; j++) {
      let p = cells[i][j].querySelector(".piece");
      if (p != null) {
        cells[i][j].removeChild(p);
      }
    }
  }
}
function redraw() {
  clearBoard();
  let board = chess.board();
  for (let i = 0; i < 8; i++) {
    for (let j = 0; j < 8; j++) {
      let b = board[i][j];
      if (board[i][j] != null) {
        cells[i][j].appendChild(makepiece(b.type, b.color));
      }
    }
  }
  checkStatus();
}
function checkStatus() {
  let stat = document.querySelector(".status");
  let hist = chess.history();
  let lastplayer = chess.turn() == "b" ? "White" : "Black";
  let nextplayer = chess.turn() == "w" ? "White" : "Black";

  let status = nextplayer + " to move";

  let audio = document.querySelector(".click");
  if (chess.in_checkmate()) {
    audio = document.querySelector(".gameover");
    status = "Checkmate";
  } else if (chess.in_check()) {
    audio = document.querySelector(".woua");
    status = nextplayer + " is check";
  } else if (chess.in_draw()) {
    audio = document.querySelector(".gameover");
    status = "Draw";
  } else if (chess.in_stalemate()) {
    audio = document.querySelector(".gameover");
    status = "Stalemate";
  } else if (hist.length > 0 && hist[hist.length - 1].indexOf("x") != -1) {
    //a piece is taken
    audio = document.querySelector(".clouch");
  }

  stat.innerHTML = status;
  if (hist.length > 0) {
    // we don't want sound for the window loading hash
    audio.volume = 0.1;
    audio.play();
  }
  document.querySelector("#pgn").value = chess.pgn();
}
function reset() {
  chess.reset();
  redraw();
}
function undo() {
  chess.undo();
  redraw();
}
function makemove(object, oponent) {
  if (connected && amiwhite == null) {
    //first move decides of who is who
    amiwhite = !oponent;
  }
  let playeriswhite = oponent ? !amiwhite : amiwhite;

  if (
    connected &&
    ((playeriswhite && chess.turn() != "w") ||
      (!playeriswhite && chess.turn() != "b"))
  )
    return;
  let m = chess.move(object);
  if (m != null) {
    // it was an ok move !
    redraw();
    window.location.hash = chess.fen().replace(/ /g, "_");
    checkStatus();
    if (!oponent) {
      sendMessage("move:" + m.san);
    }
  }
  return m;
}
window.onpopstate = function(event){
    if(event.state != null){
        chess.load_pgn(event.state)
        redraw()
    }
   
}
function loadFromhash() {
    console.log('loadfromhash')
  let fen = window.location.hash.replace(/_/g, " ").replace("#", "");
  if (fen != "") {
    if (chess.fen() != fen) {
      chess.load(fen);
    }
  }
  redraw();
  window.scrollTo(0, 0);
}

function load_pgn() {
  try {
    chess.load_pgn("" + document.querySelector("#pgn").value);
    states = [{fen: chess.fen(), pgn: chess.pgn()}];
  
    while (chess.undo()) {
      states.push({fen: chess.fen(), pgn: chess.pgn()});

    }
    states.reverse().forEach(state => {
      history.pushState(state.pgn, null, "#" + state.fen.replace(/ /g, "_"));
    });
    chess.load_pgn("" + document.querySelector("#pgn").value);
    redraw();
  } catch (err) {
    console.error(err);
  }
  return false;
}

// ----------------------------------- PEERING --------------------
let hisid = document.querySelector("#hisid");
let myid = document.querySelector("#myid");
let answer = document.querySelector("#answer");
let connStat = document.querySelector("#connection-status");
let chat = document.querySelector("#chat");
let chatInput = document.querySelector("#chat-input");

let dataChannel = null;
let idgenerated = false;
var RTCPeerConnection =
  window.RTCPeerConnection || webkitRTCPeerConnection || mozRTCPeerConnection;
var peerConn = new RTCPeerConnection({
  iceServers: [{ urls: ["stun:stun.l.google.com:19302"] }]
});
//console.log('Call create(), or join("some offer")');

function create() {
  connStat.innerHTML = "Creating ...";
  dataChannel = peerConn.createDataChannel("chess");
  dataChannel.onopen = e => {
    sendMessage("Connected Succesfully !");
  };
  dataChannel.onmessage = e => receivedMessage(e.data);
  peerConn
    .createOffer({})
    .then(desc => peerConn.setLocalDescription(desc))
    .then(() => (idgenerated = true))
    .catch(err => console.error(err));
  peerConn.onicecandidate = e => {
    if (e.candidate == null) {
      connStat.innerHTML = "Send your id to partner";
      myid.value = JSON.stringify(peerConn.localDescription);
    } else {
      myid.value = "null";
    }
  };
}
function gotAnswer() {
  peerConn.setRemoteDescription(
    new RTCSessionDescription(JSON.parse(hisid.value))
  );
  connStat.innerHTML = "Connected";
  document.querySelector(".connection").classList.add("hidden");
  document.querySelector(".chatroom").classList.remove("hidden");
  connected = true;
}
function join(offer) {
  if (idgenerated) {
    gotAnswer();
    return;
  }
  connStat.innerHTML = "Joining ...";
  if (offer == null) {
    offer = JSON.parse(document.querySelector("#hisid").value);
  }
  peerConn.ondatachannel = e => {
    dataChannel = e.channel;
    dataChannel.onopen = e => {
      sendMessage("Connected Succesfully !");
    };
    dataChannel.onmessage = e => receivedMessage(e.data);
  };

  peerConn.onicecandidate = e => {
    if (e.candidate == null) {
      myid.value = JSON.stringify(peerConn.localDescription);
      connStat.innerHTML = "Connected ! Send your id to partner";
    }
  };

  var offerDesc = new RTCSessionDescription(offer);
  peerConn.setRemoteDescription(offerDesc);
  peerConn
    .createAnswer({})
    .then(answerDesc => peerConn.setLocalDescription(answerDesc))
    .catch(err => console.warn("Couldn't create answer"));
}

function talk(e) {
  try {
    let input = document.querySelector("#chat-input");
    sendMessage(input.value);
    input.value = "";
  } catch (err) {
    throw new Error(err.message);
  }
  return false;
}

function receivedMessage(msg) {
  //-----------------  You got mail !
  console.log(msg);
  if ((msg + "").match(/Connected Succesfully !/) != null && !idgenerated)
    gotAnswer();
  let m = msg.match(/move:(.*)/);
  if (m != null) {
    m = makemove(m[1], true);
  } else {
    chat.value += msg;
  }
}

function sendMessage(msg) {
  //-----------------  sending mail !
  if (msg == "") return;
  msg = msg + "\n";
  if (dataChannel != null) dataChannel.send(msg);
  let m = msg.match(/move:(.*)/);
  if (m != null) {
    m = makemove(m[1], false);
  } else {
    chat.value += msg;
  }
}
