const $ = s => document.querySelector(s);
const money = n => new Intl.NumberFormat("id-ID",{style:"currency",currency:"IDR",maximumFractionDigits:0}).format(n);
const statusLabel = s => ({PENDING:"Menunggu pembayaran",PAID:"Pembayaran berhasil",EXPIRE:"Kedaluwarsa",CANCEL:"Dibatalkan",DENY:"Ditolak",PAYMENT_SETUP_ERROR:"Gangguan pembayaran"}[s] || s || "Belum diketahui");
let products = [];
let socket;
const toast = message => { const el=$("#toast"); el.textContent=message; el.classList.add("show"); clearTimeout(window.toastTimer); window.toastTimer=setTimeout(()=>el.classList.remove("show"),3200); };
async function api(url, options={}) {
  const response = await fetch(url,{headers:{"Content-Type":"application/json"},...options});
  const data = await response.json().catch(()=>({error:"Respons server tidak valid."}));
  if(!response.ok) throw new Error(data.error || "Permintaan gagal.");
  return data;
}
function renderProducts(list){
  const grid=$("#productGrid");
  if(!list.length){grid.innerHTML='<div class="empty">Paket tidak ditemukan. Coba kata kunci lain.</div>';return;}
  grid.innerHTML=list.map(p=>`<article class="product-card"><div class="product-top"><div class="game-logo">${p.game.split(" ").map(x=>x[0]).join("").slice(0,3)}</div><div><h3>${escapeHtml(p.game)}</h3><div class="category">${escapeHtml(p.category)}</div></div></div><div class="pack">${escapeHtml(p.name)}</div><div class="price">${money(p.price)}</div><button class="btn btn-primary buy" data-buy="${p.id}">Pilih paket ↗</button></article>`).join("");
  grid.querySelectorAll("[data-buy]").forEach(b=>b.addEventListener("click",()=>openCheckout(products.find(p=>p.id===b.dataset.buy))));
}
function escapeHtml(s){return String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
function openCheckout(p){
  if(!p)return;
  $("#productId").value=p.id;
  $("#selectedPackage").innerHTML=`<strong>${escapeHtml(p.game)} — ${escapeHtml(p.name)}</strong><br><span style="color:var(--cyan);font-weight:800">${money(p.price)}</span>`;
  $("#checkoutError").textContent="";
  $("#checkoutModal").classList.remove("hidden");
}
document.querySelectorAll("[data-close]").forEach(b=>b.onclick=()=>$("#"+b.dataset.close).classList.add("hidden"));
$("#checkoutModal").addEventListener("click",e=>{if(e.target.id==="checkoutModal")e.currentTarget.classList.add("hidden")});
$("#search").addEventListener("input",e=>{const q=e.target.value.toLowerCase();renderProducts(products.filter(p=>(p.game+" "+p.name+" "+p.category).toLowerCase().includes(q)))});
$("#checkoutForm").addEventListener("submit",async e=>{
  e.preventDefault();const button=$("#payButton");button.disabled=true;button.textContent="Menyiapkan pembayaran…";$("#checkoutError").textContent="";
  const payload={productId:$("#productId").value,playerId:$("#playerId").value.trim(),serverId:$("#serverId").value.trim(),buyerName:$("#buyerName").value.trim(),buyerEmail:$("#buyerEmail").value.trim(),buyerPhone:$("#buyerPhone").value.trim()};
  try{
    const result=await api("/api/orders",{method:"POST",body:JSON.stringify(payload)});
    $("#checkoutModal").classList.add("hidden");
    toast("Pesanan dibuat. Membuka halaman pembayaran…");
    location.href=result.redirectUrl;
  }catch(err){$("#checkoutError").textContent=err.message;}
  finally{button.disabled=false;button.textContent="Lanjut ke pembayaran";}
});
function renderOrder(o){
 return `<div class="order-item"><strong>${escapeHtml(o.orderId)}</strong> <span class="status ${escapeHtml(o.status)}">${escapeHtml(statusLabel(o.status))}</span><p>${escapeHtml(o.game)} — ${escapeHtml(o.productName)}<br>ID pemain: ${escapeHtml(o.playerId)}${o.serverId?" / Server: "+escapeHtml(o.serverId):""}<br>Total: <strong>${money(o.price)}</strong><br><small>Dibuat: ${new Date(o.createdAt).toLocaleString("id-ID")}</small></p></div>`;
}
$("#checkForm").addEventListener("submit",async e=>{
 e.preventDefault();const out=$("#orderResult");out.textContent="Memeriksa pesanan…";
 try{const o=await api("/api/orders/"+encodeURIComponent($("#orderCode").value.trim()));out.innerHTML=renderOrder(o);}
 catch(err){out.textContent=err.message;}
});
$("#historyForm").addEventListener("submit",async e=>{
 e.preventDefault();const out=$("#historyResult");out.textContent="Memuat riwayat…";
 const email=$("#historyEmail").value.trim(),phone=$("#historyPhone").value.trim();
 if(!email&&!phone){out.textContent="Isi email atau nomor HP.";return;}
 try{const rows=await api("/api/history?"+new URLSearchParams({email,phone}));out.innerHTML=rows.length?rows.map(renderOrder).join(""):"Belum ada transaksi yang cocok dengan data tersebut.";}
 catch(err){out.textContent=err.message;}
});
$("#chatOpen").onclick=()=>$("#chatPanel").classList.remove("hidden");
$("#chatClose").onclick=()=>$("#chatPanel").classList.add("hidden");
function addChat(m){
 const box=$("#chatMessages"),el=document.createElement("div");el.className="chat-bubble";
 const name=document.createElement("b");name.textContent=m.name||"Pelanggan";
 const message=document.createElement("div");message.textContent=m.message;
 const time=document.createElement("time");time.textContent=new Date(m.at||Date.now()).toLocaleTimeString("id-ID",{hour:"2-digit",minute:"2-digit"});
 el.append(name,message,time);box.appendChild(el);box.scrollTop=box.scrollHeight;
}
$("#chatForm").addEventListener("submit",e=>{
 e.preventDefault();const message=$("#chatMessage").value.trim();if(!message||!socket)return;
 socket.emit("chat:message",{name:$("#chatName").value.trim()||"Pelanggan",message});
 $("#chatMessage").value="";
});
(async()=>{
 $("#year").textContent=new Date().getFullYear();
 try{products=await api("/api/products");renderProducts(products);}
 catch(e){$("#productGrid").innerHTML='<div class="empty">Katalog belum dapat dimuat. Periksa koneksi server.</div>';}
 try{
   const cfg=await api("/api/config");
   if(!cfg.paymentConfigured) console.warn("Payment gateway belum dikonfigurasi di server.");
 }catch(e){console.warn(e);}
 if(window.io){socket=io();socket.on("chat:message",addChat);socket.on("order:update",update=>{
   if($("#orderCode").value.trim()===update.orderId) $("#checkForm").requestSubmit();
 });}
 const params=new URLSearchParams(location.search),order=params.get("order");
 if(order){$("#orderCode").value=order;document.querySelector("#cek").scrollIntoView();$("#checkForm").requestSubmit();history.replaceState({}, "", location.pathname);}
})();
                                     
