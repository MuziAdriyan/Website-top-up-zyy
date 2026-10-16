require("dotenv").config();
const express = require("express");
const http = require("http");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const { Server } = require("socket.io");
const midtransClient = require("midtrans-client");

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const PORT = process.env.PORT || 3000;
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;
const DATA_DIR = path.join(__dirname, "data");
const ORDERS_FILE = path.join(DATA_DIR, "orders.json");
fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(ORDERS_FILE)) fs.writeFileSync(ORDERS_FILE, "[]");

app.use(express.json({ limit: "200kb" }));
app.use(express.static(path.join(__dirname, "public")));

const catalog = [
  { id:"ml86", game:"Mobile Legends", name:"86 Diamonds", amount:86, price:22000, category:"MOBA" },
  { id:"ml172", game:"Mobile Legends", name:"172 Diamonds", amount:172, price:44000, category:"MOBA" },
  { id:"ml257", game:"Mobile Legends", name:"257 Diamonds", amount:257, price:65000, category:"MOBA" },
  { id:"ff70", game:"Free Fire", name:"70 Diamonds", amount:70, price:10000, category:"Battle Royale" },
  { id:"ff140", game:"Free Fire", name:"140 Diamonds", amount:140, price:20000, category:"Battle Royale" },
  { id:"ff355", game:"Free Fire", name:"355 Diamonds", amount:355, price:50000, category:"Battle Royale" },
  { id:"pubg60", game:"PUBG Mobile", name:"60 UC", amount:60, price:16000, category:"Battle Royale" },
  { id:"pubg325", game:"PUBG Mobile", name:"325 UC", amount:325, price:79000, category:"Battle Royale" },
  { id:"genshin60", game:"Genshin Impact", name:"60 Genesis Crystals", amount:60, price:16000, category:"RPG" },
  { id:"robux80", game:"Roblox", name:"80 Robux", amount:80, price:16000, category:"Casual" }
];
function readOrders(){ try { return JSON.parse(fs.readFileSync(ORDERS_FILE, "utf8")); } catch { return []; } }
function saveOrders(items){ fs.writeFileSync(ORDERS_FILE, JSON.stringify(items, null, 2)); }
function makeOrderCode(){ return "MZG-" + Date.now().toString(36).toUpperCase() + "-" + crypto.randomBytes(3).toString("hex").toUpperCase(); }
function cleanText(v, max=100){ return String(v || "").trim().replace(/[<>]/g, "").slice(0,max); }
function paymentReady(){
  return !!(process.env.MIDTRANS_SERVER_KEY && process.env.MIDTRANS_CLIENT_KEY &&
    !process.env.MIDTRANS_SERVER_KEY.includes("YOUR_") && !process.env.MIDTRANS_CLIENT_KEY.includes("YOUR_"));
}
function snapClient(){
  return new midtransClient.Snap({
    isProduction: String(process.env.MIDTRANS_IS_PRODUCTION).toLowerCase() === "true",
    serverKey: process.env.MIDTRANS_SERVER_KEY,
    clientKey: process.env.MIDTRANS_CLIENT_KEY
  });
}
app.get("/api/config", (req,res) => res.json({
  storeName:"Muzi Shope Game",
  paymentConfigured:paymentReady(),
  midtransClientKey: paymentReady() ? process.env.MIDTRANS_CLIENT_KEY : null,
  isProduction:String(process.env.MIDTRANS_IS_PRODUCTION).toLowerCase() === "true"
}));
app.get("/api/products", (req,res) => res.json(catalog));
app.post("/api/orders", async (req,res) => {
  try {
    const { productId, playerId, serverId, buyerName, buyerEmail, buyerPhone } = req.body || {};
    const product = catalog.find(p => p.id === productId);
    if (!product) return res.status(400).json({error:"Paket tidak ditemukan."});
    if (!/^[A-Za-z0-9_-]{3,40}$/.test(String(playerId || "").trim()))
      return res.status(400).json({error:"ID pemain wajib diisi (3–40 karakter, huruf/angka/_/-)."});
    const order = {
      orderId:makeOrderCode(), productId:product.id, productName:product.name,
      game:product.game, amount:product.amount, price:product.price,
      playerId:cleanText(playerId,40), serverId:cleanText(serverId,30),
      buyerName:cleanText(buyerName,80), buyerEmail:cleanText(buyerEmail,120),
      buyerPhone:cleanText(buyerPhone,30), status:"PENDING", paymentStatus:"pending",
      createdAt:new Date().toISOString(), paymentType:"QRIS / metode tersedia di Midtrans"
    };
    if (!paymentReady()) {
      return res.status(503).json({
        error:"Pembayaran belum diaktifkan. Pemilik toko perlu mengisi MIDTRANS_SERVER_KEY dan MIDTRANS_CLIENT_KEY pada environment server. Pesanan belum dibuat."
      });
    }
    const items = readOrders();
    items.unshift(order);
    saveOrders(items);
    try {
      const snap = snapClient();
      const transaction = await snap.createTransaction({
        transaction_details:{ order_id:order.orderId, gross_amount:order.price },
        item_details:[{ id:product.id, price:product.price, quantity:1, name:`${product.game} - ${product.name}`.slice(0,50) }],
        customer_details:{
          first_name:order.buyerName || "Pelanggan",
          email:order.buyerEmail || undefined,
          phone:order.buyerPhone || undefined
        },
        callbacks:{ finish:`${BASE_URL}/?order=${encodeURIComponent(order.orderId)}` }
      });
      order.snapToken = transaction.token;
      order.redirectUrl = transaction.redirect_url;
      saveOrders(items);
      res.status(201).json({orderId:order.orderId, redirectUrl:transaction.redirect_url, snapToken:transaction.token});
    } catch (e) {
      order.status = "PAYMENT_SETUP_ERROR";
      order.errorMessage = "Payment provider could not create transaction";
      saveOrders(items);
      console.error("Midtrans transaction error:", e.message);
      res.status(502).json({error:"Gateway pembayaran gagal membuat transaksi. Periksa konfigurasi akun dan server, lalu coba lagi."});
    }
  } catch (e) {
    console.error(e);
    res.status(500).json({error:"Terjadi kesalahan server."});
  }
});
app.get("/api/orders/:id", (req,res) => {
  const id = cleanText(req.params.id,60);
  const order = readOrders().find(o => o.orderId === id);
  if (!order) return res.status(404).json({error:"Pesanan tidak ditemukan."});
  const { snapToken, errorMessage, ...safe } = order;
  res.json(safe);
});
app.get("/api/history", (req,res) => {
  const email = cleanText(req.query.email,120).toLowerCase();
  const phone = cleanText(req.query.phone,30);
  if (!email && !phone) return res.status(400).json({error:"Masukkan email atau nomor HP pembeli."});
  const found = readOrders().filter(o => (email && o.buyerEmail.toLowerCase() === email) || (phone && o.buyerPhone === phone))
    .slice(0,50).map(({snapToken,errorMessage,...o})=>o);
  res.json(found);
});
// Midtrans calls this endpoint after payment status changes. Validate signature before updating status.
app.post("/api/midtrans/notification", async (req,res) => {
  try {
    if (!paymentReady()) return res.status(503).end();
    const api = new midtransClient.CoreApi({
      isProduction:String(process.env.MIDTRANS_IS_PRODUCTION).toLowerCase() === "true",
      serverKey:process.env.MIDTRANS_SERVER_KEY,
      clientKey:process.env.MIDTRANS_CLIENT_KEY
    });
    const status = await api.transaction.notification(req.body);
    const orders = readOrders();
    const order = orders.find(o => o.orderId === status.order_id);
    if (!order) return res.status(404).json({message:"Order not found"});
    order.paymentStatus = status.transaction_status || "pending";
    if (status.transaction_status === "settlement" || status.transaction_status === "capture") {
      order.status = "PAID";
    } else if (["deny","cancel","expire","failure"].includes(status.transaction_status)) {
      order.status = status.transaction_status.toUpperCase();
    } else if (status.transaction_status === "pending") {
      order.status = "PENDING";
    }
    order.updatedAt = new Date().toISOString();
    saveOrders(orders);
    io.emit("order:update", {orderId:order.orderId, status:order.status, paymentStatus:order.paymentStatus});
    res.json({message:"ok"});
  } catch(e) {
    console.error("Notification verification failed:", e.message);
    res.status(400).json({error:"Invalid notification"});
  }
});
io.on("connection", socket => {
  socket.on("chat:message", payload => {
    const message = cleanText(payload && payload.message,500);
    const name = cleanText(payload && payload.name,50) || "Pelanggan";
    if (!message) return;
    // Storefront chat is a public room. Do not send passwords, OTPs, or payment secrets.
    io.emit("chat:message", {name, message, at:new Date().toISOString()});
  });
  socket.on("chat:admin", payload => {
    if (!process.env.ADMIN_CHAT_TOKEN || payload?.token !== process.env.ADMIN_CHAT_TOKEN) return;
    const message = cleanText(payload.message,500);
    if (message) io.emit("chat:message", {name:"Admin Muzi", message, at:new Date().toISOString()});
  });
});
app.get("*", (req,res) => res.sendFile(path.join(__dirname,"public","index.html")));
server.listen(PORT, () => console.log(`Muzi Shope Game running on ${PORT}`));
