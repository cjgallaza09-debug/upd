/* Cash Register X Automatic - Supabase POS - v7 instant cart rendering */
const cfg=window.SUPABASE_CONFIG||{};
const sb=window.supabase?.createClient(cfg.url||'',cfg.anonKey||'');
let user=null, role='staff', page='dashboard', username='';
window.pwdDiscount=false;
let products=[],categories=[],sales=[],expenses=[],stocks=[],cart=[],editing=null;
const $=id=>document.getElementById(id);
const esc=v=>{const d=document.createElement('div');d.textContent=String(v??'');return d.innerHTML};
const money=v=>'₱'+Number(v||0).toLocaleString('en-PH',{minimumFractionDigits:2,maximumFractionDigits:2});
const today=()=>new Date().toISOString().slice(0,10);
const uid=()=>crypto.randomUUID?.()||String(Date.now()+Math.random());
function toast(msg,type=''){const t=$('toast');t.textContent=msg;t.className='toast '+type;clearTimeout(window.__toast);window.__toast=setTimeout(()=>t.className='',3000)}
function valid(){if(!cfg.url||cfg.url.includes('YOUR_PROJECT')||!cfg.anonKey||cfg.anonKey.includes('YOUR_')){toast('Open config.js and add your Supabase project URL and publishable key.','error');return false}return true}
async function q(table,action){try{return await action()}catch(e){return {error:{message:e.message}}}}

const pageTitles={dashboard:'Dashboard',pos:'Point of Sale',products:'Products',inventory:'Inventory',sales:'Sales History',expenses:'Expenses',reports:'Reports',settings:'Settings',staff:'Staff Accounts'};
// Staff can use Dashboard, POS, and Inventory only. Products and all management pages are Admin-only.
const staffPages=new Set(['dashboard','pos','inventory']);
const canAccessPage=p=>(['products','sales','expenses','reports','settings','staff'].includes(p)?role==='admin':(role==='admin'||role==='staff'||role==='manager')&&staffPages.has(p));
function applyRoleNavigation(){
  document.querySelectorAll('.nav-btn,.mobile-nav-btn').forEach(b=>{
    const allowed=canAccessPage(b.dataset.page);
    b.classList.toggle('hidden',!allowed);
    b.setAttribute('aria-hidden',allowed?'false':'true');
    b.tabIndex=allowed?0:-1;
  });
}
function setPage(p){
  if(!pageTitles[p]||!canAccessPage(p)){
    if(p!==page)toast('This page is available to Admin only.','error');
    p='dashboard';
  }
  page=p;
  applyRoleNavigation();
  document.querySelectorAll('.nav-btn,.mobile-nav-btn').forEach(b=>b.classList.toggle('active',b.dataset.page===p));
  $('pageTitle').textContent=pageTitles[p];
  render();
  if(innerWidth<=1024)closeSidebar();
}
function modal(title,body){$('modalTitle').textContent=title;$('modalBody').innerHTML='<div class="modal-body">'+body+'</div>';$('modal').classList.remove('hidden')}
function closeModal(){$('modal').classList.add('hidden');editing=null}
$('modalClose').onclick=closeModal;$('modal').onclick=e=>{if(e.target.id==='modal')closeModal()};

let loadingData=false;
async function loadAll(){
  if(loadingData)return;
  loadingData=true;
  const requests=[
    ['categories',sb.from('categories').select('*').order('name')],
    ['products',sb.from('products').select('*').order('name')],
    ['sales',sb.from('sales').select('*, sale_items(*)').order('created_at',{ascending:false}).limit(500)],
    ['expenses',sb.from('expenses').select('*').order('created_at',{ascending:false}).limit(500)],
    ['stocks',sb.from('stocks').select('*').order('created_at',{ascending:false})]
  ];
  const results=await Promise.all(requests.map(async ([table,promise])=>{
    try{
      const {data,error}=await promise;
      return {table,data:data||[],error};
    }catch(e){
      return {table,data:[],error:{message:e.message}};
    }
  }));
  let errors=[];
  for(const r of results){
    if(r.error){
      console.warn(r.table,r.error.message);
      errors.push(r.table);
      continue;
    }
    if(r.table==='categories')categories=r.data;
    else if(r.table==='products')products=r.data;
    else if(r.table==='sales')sales=r.data;
    else if(r.table==='expenses')expenses=r.data;
    else if(r.table==='stocks')stocks=r.data;
  }
  loadingData=false;
  render();
  if(errors.length)toast('Could not load: '+errors.join(', '),'error');
}
async function loadRole(){const {data}=await sb.from('profiles').select('role,username').eq('id',user.id).maybeSingle();role=data?.role||'staff';username=data?.username||'';$('roleBadge').textContent=role.toUpperCase();$('userEmail').textContent=username||'User';applyRoleNavigation();if(!canAccessPage(page))page='dashboard'}
async function session(s){user=s?.user||null;if(!user){$('app').classList.add('hidden');$('authScreen').classList.remove('hidden');return}$('authScreen').classList.add('hidden');$('app').classList.remove('hidden');await loadRole();await loadAll()}

function stat(label,value,sub=''){return `<div class="card"><div class="stat-label">${label}</div><div class="stat-value">${value}</div><div class="stat-sub">${sub}</div></div>`}
function recentSales(){return sales.slice(0,8).map(s=>`<tr><td>#${esc(String(s.id).slice(0,8))}</td><td>${esc(s.sale_date)}</td><td>${esc(s.payment_method)}</td><td class="num">${money(s.total)}</td><td>${esc(s.status||'completed')}</td></tr>`).join('')||'<tr><td colspan="5" class="empty">No sales yet.</td></tr>'}
function dashboard(){const d=today(),daySales=sales.filter(s=>s.sale_date===d&&!['refunded','void'].includes(s.status));const ds=daySales.reduce((a,s)=>a+Number(s.total||0),0);const de=expenses.filter(e=>e.expense_date===d).reduce((a,e)=>a+Number(e.amount||0),0);const low=stocks.filter(s=>Number(s.quantity)>0&&Number(s.quantity)<=Number(s.low_limit??3)).length,out=stocks.filter(s=>Number(s.quantity)<=0).length;return `<div class="grid stats">${stat("Today's Sales",money(ds),daySales.length+' transaction(s)')}${stat("Today's Expenses",money(de),'Recorded expenses')}${stat('Net Sales',money(ds-de),'Sales minus expenses')}${stat('Inventory Alerts',low+out,low+' low • '+out+' out')}</div><div class="grid two" style="margin-top:16px"><div class="panel"><div class="panel-head"><h3>Recent Sales</h3><button class="btn light" onclick="setPage('sales')">View all</button></div><div class="table-wrap"><table><thead><tr><th>Receipt</th><th>Date</th><th>Payment</th><th class="num">Total</th><th>Status</th></tr></thead><tbody>${recentSales()}</tbody></table></div></div><div class="panel"><div class="panel-head"><h3>Inventory Alerts</h3><button class="btn light" onclick="setPage('inventory')">Inventory</button></div>${out?`<div class="alert">${out} item(s) are out of stock.</div>`:''}${low?`<div class="alert">${low} item(s) are low stock.</div>`:''}${!out&&!low?'<div class="empty">Inventory looks good.</div>':stocks.filter(s=>Number(s.quantity)<=Number(s.low_limit??3)).slice(0,7).map(s=>`<div style="display:flex;justify-content:space-between;padding:9px 0;border-bottom:1px solid var(--line)"><span>${esc(s.name)}</span><b class="${Number(s.quantity)===0?'out':'low'}">${s.quantity}</b></div>`).join('')}</div></div>`}

function pos(){const cats=categories.length?categories:[{id:'all',name:'All'}];const filtered=pagePosCategory==='all'?products:products.filter(p=>p.category_id===pagePosCategory);return `<div class="pos-layout"><div><div class="mobile-section-title"><b>Products</b><span class="muted">Tap a product to add it</span></div><div class="filters pos-filters" style="margin-bottom:12px"><input id="posSearch" class="search" placeholder="Search product..." value="${esc(window.posSearch||'')}"><select id="posCat" class="search"><option value="all">All categories</option>${cats.filter(c=>c.id!=='all').map(c=>`<option value="${c.id}" ${pagePosCategory===c.id?'selected':''}>${esc(c.name)}</option>`).join('')}</select></div><div class="product-grid">${filtered.filter(p=>!window.posSearch||p.name.toLowerCase().includes(window.posSearch.toLowerCase())).map(p=>`<button class="product-btn shape-${esc(p.pos_shape||'box')}" onclick="addCart('${p.id}')"><small>${esc(categories.find(c=>c.id===p.category_id)?.name||'Product')}</small><b>${esc(p.name)}</b><span>${money(p.price)}</span></button>`).join('')||'<div class="empty">No products found.</div>'}</div></div><div id="cartMount">${cartPanel()}</div></div>`}
let pagePosCategory='all';
function stockRecord(pid){return stocks.find(x=>x.product_id===pid)}
function stockFor(pid){const s=stockRecord(pid);return s?Number(s.quantity):'—'}
function stockUnit(pid){return stockRecord(pid)?.unit||'pcs'}
function formatQty(v){const n=Number(v||0);return Number.isInteger(n)?String(n):n.toFixed(3).replace(/0+$/,'').replace(/\.$/,'')}
function unitStep(unit){return unit==='kg'?0.01:1}
function cartSubtotal(){return cart.reduce((a,i)=>a+Number(i.price)*Number(i.qty),0)}
function pwdDiscountAmount(subtotal){return window.pwdDiscount?Number((subtotal*0.20).toFixed(2)):0}
function cartTotal(){const subtotal=cartSubtotal();const discount=pwdDiscountAmount(subtotal);return Math.max(0,subtotal-discount)}
function cartPanel(){
  const subtotal=Number(cart.reduce((sum,i)=>sum+(Number(i.price)||0)*(Number(i.qty)||0),0));
  const discount=pwdDiscountAmount(subtotal);
  const total=Math.max(0,subtotal-discount);
  return `<div class="panel cart" data-cart-total="${total}">
    <div class="panel-head">
      <div><h3>Current Order</h3><small class="muted">${cart.length} item${cart.length===1?'':'s'}</small></div>
      <button class="btn light" onclick="clearCart()">Clear</button>
    </div>
    ${cart.length?cart.map((i,n)=>{
      const qty=Number(i.qty)||0, price=Number(i.price)||0;
      return `<div class="cart-row" data-cart-row="${n}">
        <div><b>${esc(i.name)}</b><small class="muted" style="display:block">${money(price)} / pcs</small></div>
        <input class="qty qty-input" type="number" min="1" step="1" value="${qty}" oninput="changeQtyLive(${n},this.value)" inputmode="numeric">
        <b class="cart-line-total">${money(price*qty)}</b>
        <button class="icon-btn" onclick="removeCart(${n})" aria-label="Remove ${esc(i.name)}">×</button>
      </div>`;
    }).join(''):'<div class="empty">Add products to start an order.</div>'}
    <div class="cart-total">
      <div class="total-line"><span>Subtotal</span><b id="cartSubtotalValue">${money(subtotal)}</b></div>
      <div class="pwd-row"><label class="check-label"><input id="pwdDiscount" type="checkbox" ${window.pwdDiscount?'checked':''}> <span>PWD Discount <b>20%</b></span></label><span id="pwdDiscountValue" class="pwd-value">−${money(discount)}</span></div>
      <div class="total-line big"><span>Total</span><span id="cartTotalValue">${money(total)}</span></div>
      <button class="btn primary wide checkout-btn" onclick="checkout()" ${cart.length?'':'disabled'}>Charge & Complete Sale</button>
    </div>
  </div>`;
}
function updateCartTotalsLive(){
  const subtotal=Number(cart.reduce((sum,i)=>sum+(Number(i.price)||0)*(Number(i.qty)||0),0));
  const discount=pwdDiscountAmount(subtotal);
  const total=Math.max(0,subtotal-discount);
  const subNode=$('cartSubtotalValue'), totalNode=$('cartTotalValue'), cartNode=document.querySelector('.cart');
  if(subNode)subNode.textContent=money(subtotal);
  if(totalNode)totalNode.textContent=money(total);
  if(cartNode)cartNode.dataset.cartTotal=String(total);
  const pwdNode=$('pwdDiscountValue');
  if(pwdNode)pwdNode.textContent='−'+money(discount);
}
function changeQtyLive(i,v){
  if(!cart[i])return;
  let q=Math.max(1,Number(v)||1);
  q=Number(q.toFixed(3));
  cart[i].qty=q;
  const input=document.querySelector(`[data-cart-row="${i}"] .qty-input`);
  if(input && document.activeElement!==input)input.value=q;
  const line=document.querySelector(`[data-cart-row="${i}"] .cart-line-total`);
  if(line)line.textContent=money((Number(cart[i].price)||0)*q);
  updateCartTotalsLive();
}
function togglePwdDiscount(){
  window.pwdDiscount=!!$('pwdDiscount')?.checked;
  updateCartTotalsLive();
}

function updateCartPanelFast(){
  const mount=$('cartMount');
  if(!mount){return render();}

  mount.innerHTML=cartPanel();
  const pwd=$('pwdDiscount');
  if(pwd)pwd.onchange=togglePwdDiscount;
  updateCartTotalsLive();
}
function addCart(id){
  const p=products.find(x=>x.id===id);
  if(!p)return;
  // POS is intentionally independent from Inventory/Stock.
  // Selling a product does not check, read, or change stock.
  const unit='pcs';
  const found=cart.find(x=>x.product_id===id);
  const step=1;
  if(found){
    found.qty=Number((found.qty+step).toFixed(3));
  }else{
    cart.push({product_id:p.id,name:p.name,price:Number(p.price),qty:step,unit});
  }
  // Do NOT rebuild the whole POS page. Only replace the cart panel.
  updateCartPanelFast();
}
function changeQty(i,v){changeQtyLive(i,v)}
function removeCart(i){cart.splice(i,1);updateCartPanelFast()}
function clearCart(){cart=[];window.pwdDiscount=false;updateCartPanelFast()}

function productsPage(){return `<div class="panel"><div class="panel-head"><h3>Product Catalog</h3><div class="actions"><button class="btn primary" onclick="productForm()">+ Add Product</button><button class="btn light" onclick="categoryForm()">Categories</button></div></div><div class="filters"><input id="productSearch" class="search" placeholder="Search products..."></div><div class="table-wrap" style="margin-top:14px"><table><thead><tr><th>Product</th><th>Category</th><th>POS Shape</th><th class="num">Price</th><th>Action</th></tr></thead><tbody>${products.map(p=>`<tr><td><b>${esc(p.name)}</b><div class="small">${esc(p.sku||'')}</div></td><td>${esc(categories.find(c=>c.id===p.category_id)?.name||'Uncategorized')}</td><td><span class="shape-badge shape-${esc(p.pos_shape||'box')}">${esc(String(p.pos_shape||'box').replace(/^./,m=>m.toUpperCase()))}</span></td><td class="num">${money(p.price)}</td><td><button class="btn light" onclick="productForm('${p.id}')">Edit</button> <button class="btn danger" onclick="deleteProduct('${p.id}')">Delete</button></td></tr>`).join('')||'<tr><td colspan="5" class="empty">No products yet.</td></tr>'}</tbody></table></div></div>`}
function productForm(id){const p=products.find(x=>x.id===id)||{};const shapes=[['circle','Circle'],['box','Box'],['triangle','Triangle'],['hexagon','Hexagon']];modal(id?'Edit Product':'Add Product',`<form id="productForm"><div class="field-grid"><div class="field"><label>Name<input name="name" required value="${esc(p.name||'')}"></label></div><div class="field"><label>SKU<input name="sku" value="${esc(p.sku||'')}"></label></div><div class="field"><label>Category<select name="category_id"><option value="">Uncategorized</option>${categories.map(c=>`<option value="${c.id}" ${p.category_id===c.id?'selected':''}>${esc(c.name)}</option>`).join('')}</select></label></div><div class="field"><label>Price<input name="price" type="number" min="0" step="0.01" required value="${p.price??''}"></label></div><div class="field"><label>Cost<input name="cost" type="number" min="0" step="0.01" value="${p.cost??0}"></label></div><div class="field"><label>Active<select name="active"><option value="true" ${p.active!==false?'selected':''}>Yes</option><option value="false" ${p.active===false?'selected':''}>No</option></select></label></div><div class="field" style="grid-column:1/-1"><label>POS Button Shape<select name="pos_shape">${shapes.map(([v,l])=>`<option value="${v}" ${(p.pos_shape||'box')===v?'selected':''}>${l}</option>`).join('')}</select></label><div class="form-hint">Choose how this product appears on the POS: Circle, Box, Triangle, or Hexagon.</div></div></div><div class="actions"><button class="btn primary" type="submit">Save Product</button></div></form>`);$('productForm').onsubmit=async e=>{e.preventDefault();const f=new FormData(e.target);const data={name:String(f.get('name')||'').trim(),sku:String(f.get('sku')||'').trim()||null,category_id:f.get('category_id')||null,price:Number(f.get('price')),cost:Number(f.get('cost')||0),active:f.get('active')==='true',pos_shape:f.get('pos_shape')||'box'};const res=id?await sb.from('products').update(data).eq('id',id):await sb.from('products').insert(data);if(res.error)toast(res.error.message,'error');else{closeModal();await loadAll();toast('Product saved.','success')}}}
async function deleteProduct(id){if(!confirm('Delete this product?'))return;const {error}=await sb.from('products').delete().eq('id',id);if(error)toast(error.message,'error');else{await loadAll();toast('Product deleted.')}}
function categoryForm(){modal('Categories',`<form id="catForm" class="actions"><input id="catName" class="search" placeholder="Category name" required><button class="btn primary">Add</button></form><div style="margin-top:14px">${categories.map(c=>`<div style="display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid var(--line)"><span>${esc(c.name)}</span><button class="btn danger" onclick="deleteCategory('${c.id}')">Delete</button></div>`).join('')||'<div class="empty">No categories.</div>'}</div>`);$('catForm').onsubmit=async e=>{e.preventDefault();const name=$('catName').value.trim();if(!name)return;const {error}=await sb.from('categories').insert({name});if(error)toast(error.message,'error');else{await loadAll();categoryForm()}}}
async function deleteCategory(id){if(!confirm('Delete this category? Products will become uncategorized.'))return;const {error}=await sb.from('categories').delete().eq('id',id);if(error)toast(error.message,'error');else{await loadAll();categoryForm()}}

function inventory(){return `<div class="panel"><div class="panel-head"><div><h3>Inventory</h3><p class="muted">Track stock using pcs, packs, btls, or kilos.</p></div><div class="actions"><button class="btn primary" onclick="stockForm()">+ Add Stock Item</button><button class="btn success" onclick="exportInventory()">Export Excel</button><label class="btn light">Import Excel<input id="stockImport" type="file" accept=".xlsx,.xls" hidden onchange="importInventory(this)"></label></div></div><div class="table-wrap"><table><thead><tr><th>Product</th><th>SKU</th><th class="num">Stock</th><th>Unit</th><th class="num">Low Limit</th><th>Status</th><th>Action</th></tr></thead><tbody>${stocks.map(s=>{const p=products.find(x=>x.id===s.product_id);const q=Number(s.quantity);const unit=s.unit||'pcs';return `<tr><td><b>${esc(p?.name||s.name||'Unknown')}</b></td><td>${esc(p?.sku||'')}</td><td class="num"><input class="qty" value="${q}" type="number" min="0" step="${unitStep(unit)}" onchange="setStock('${s.id}',this.value)"></td><td><span class="unit-badge">${esc(unit)}</span></td><td class="num">${formatQty(s.low_limit??3)}</td><td class="${q===0?'out':q<=Number(s.low_limit??3)?'low':'ok'}">${q===0?'OUT OF STOCK':q<=Number(s.low_limit??3)?'LOW STOCK':'IN STOCK'}</td><td><div class="actions"><button class="btn light" onclick="stockForm('${s.id}')">Edit</button><button class="btn danger" onclick="deleteStock('${s.id}')">Delete</button></div></td></tr>`}).join('')||'<tr><td colspan="7" class="empty">No inventory records. Add a stock item by typing its product name.</td></tr>'}</tbody></table></div></div>`}
async function stockForm(id){
  const s=stocks.find(x=>x.id===id)||{};
  const units=[['pcs','Pieces (pcs)'],['kg','Kilos (kg)'],['packs','Packs'],['btls','Bottles (btls)']];
  const currentProduct=products.find(p=>p.id===s.product_id);
  modal(id?'Edit Stock':'Add Stock',`<form id="stockForm">
    <div class="field-grid">
      <div class="field" style="grid-column:1/-1">
        <label>Product Name
          <input name="product_name" type="text" required autocomplete="off"
            placeholder="Type product name..."
            value="${esc(currentProduct?.name||s.name||'')}">
        </label>
        <div class="form-hint">Type the product name. If it already exists, it will be linked automatically. If it is new, it will be created as a product.</div>
      </div>
      <div class="field">
        <label>Unit
          <select name="unit" required>${units.map(([v,l])=>`<option value="${v}" ${(s.unit||'pcs')===v?'selected':''}>${l}</option>`).join('')}</select>
        </label>
      </div>
      <div class="field">
        <label>Quantity
          <input name="quantity" type="number" min="0" step="0.001" required value="${s.quantity??0}">
        </label>
      </div>
      <div class="field">
        <label>Low Stock Limit
          <input name="low_limit" type="number" min="0" step="0.001" required value="${s.low_limit??3}">
        </label>
      </div>
    </div>
    <div class="form-hint">Use decimals for kilos, for example <b>2.5 kg</b>. Use whole numbers for pcs, packs, and btls.</div>
    <button class="btn primary wide">Save Stock</button>
  </form>`);
  $('stockForm').onsubmit=async e=>{
    e.preventDefault();
    const f=new FormData(e.target);
    const productName=String(f.get('product_name')||'').trim();
    const quantity=Math.max(0,Number(f.get('quantity'))||0);
    const unit=String(f.get('unit')||'pcs');
    const low_limit=Math.max(0,Number(f.get('low_limit'))||0);
    if(!productName){toast('Enter a product name.','error');return;}

    let product=products.find(p=>String(p.name||'').trim().toLowerCase()===productName.toLowerCase());

    if(!product){
      const {data,error}=await sb.from('products').insert({
        name:productName,
        price:0,
        cost:0,
        active:true
      }).select('*').single();
      if(error){toast(error.message,'error');return;}
      product=data;
      products.push(product);
    }

    const data={
      product_id:product.id,
      name:product.name,
      quantity,
      unit,
      low_limit,
      updated_at:new Date().toISOString()
    };

    if(id){
      const {error}=await sb.from('stocks').update(data).eq('id',id);
      if(error){toast(error.message,'error');return;}
    }else{
      const existing=stocks.find(x=>x.product_id===product.id);
      if(existing){
        const newQty=Number(existing.quantity||0)+quantity;
        const {error}=await sb.from('stocks').update({
          quantity:newQty,
          unit,
          low_limit,
          name:product.name,
          updated_at:new Date().toISOString()
        }).eq('id',existing.id);
        if(error){toast(error.message,'error');return;}
      }else{
        const {error}=await sb.from('stocks').insert(data);
        if(error){toast(error.message,'error');return;}
      }
    }

    closeModal();
    await loadAll();
    toast('Inventory saved.','success');
  };
}
async function setStock(id,v){const quantity=Math.max(0,Number(v)||0);const {error}=await sb.from('stocks').update({quantity}).eq('id',id);if(error)toast(error.message,'error');else{await loadAll();toast('Stock updated.')}}
async function deleteStock(id){if(!confirm('Delete this inventory record?'))return;const {error}=await sb.from('stocks').delete().eq('id',id);if(error)toast(error.message,'error');else{await loadAll();toast('Stock deleted.')}}

function salesPage(){return `<div class="panel"><div class="panel-head"><h3>Sales History</h3><div class="actions"><button class="btn success" onclick="exportSales()">Export Excel</button><button class="btn light" onclick="printSales()">Print</button></div></div><div class="filters"><input id="salesDate" type="date" value="${window.salesDate||''}" onchange="window.salesDate=this.value;render()" class="search" style="max-width:190px"><select id="salesPayment" class="search" style="max-width:190px"><option value="">All payments</option><option>Cash</option><option>GCash</option><option>Maya</option><option>Card</option><option>Other</option></select><input id="salesSearch" class="search" placeholder="Search receipt..."></div><div class="table-wrap" style="margin-top:14px"><table><thead><tr><th>Receipt</th><th>Date</th><th>Payment</th><th class="num">Subtotal</th><th class="num">PWD Discount</th><th class="num">Total</th><th>Status</th><th>Action</th></tr></thead><tbody>${sales.filter(s=>!window.salesDate||s.sale_date===window.salesDate).map(s=>`<tr><td>#${esc(String(s.id).slice(0,8))}</td><td>${s.sale_date}</td><td>${esc(s.payment_method)}</td><td class="num">${money(s.subtotal)}</td><td class="num">${s.pwd_discount?money(s.discount):money(0)}</td><td class="num"><b>${money(s.total)}</b></td><td>${esc(s.status||'completed')}</td><td><button class="btn light" onclick="receipt('${s.id}')">Receipt</button>${role==='admin'?` <button class="btn danger" onclick="refundSale('${s.id}')">Refund</button>`:''}</td></tr>`).join('')||'<tr><td colspan="8" class="empty">No sales found.</td></tr>'}</tbody></table></div></div>`}
function receipt(id){const s=sales.find(x=>x.id===id);if(!s)return;modal('Receipt #'+String(id).slice(0,8),`<div style="text-align:center"><h2>Cash Register X</h2><p>${s.sale_date} • ${esc(s.payment_method)}</p></div><div class="table-wrap"><table><thead><tr><th>Item</th><th class="num">Qty</th><th class="num">Amount</th></tr></thead><tbody>${(s.sale_items||[]).map(i=>`<tr><td>${esc(i.product_name||'Item')}</td><td class="num">${i.quantity}</td><td class="num">${money(i.line_total)}</td></tr>`).join('')}</tbody></table></div><div class="total-line"><span>Subtotal</span><b>${money(s.subtotal)}</b></div>${s.pwd_discount?`<div class="total-line"><span>PWD Discount (20%)</span><b>−${money(s.discount)}</b></div>`:''}<div class="total-line big"><span>Total</span><b>${money(s.total)}</b></div><button class="btn primary wide" onclick="window.print()">Print Receipt</button>`)}
async function refundSale(id){if(!canAccessPage('sales')){toast('Admin access required.','error');return;}if(!confirm('Mark this sale as refunded?'))return;const {error}=await sb.from('sales').update({status:'refunded'}).eq('id',id);if(error)toast(error.message,'error');else{await loadAll();toast('Sale refunded.')}}

function expensesPage(){const total=expenses.reduce((a,e)=>a+Number(e.amount||0),0);const cats=['Ingredients','Supplies','Transportation','Utilities','Staff','Equipment','Rent','Maintenance','Other'];return `<div class="grid two"><div class="panel"><div class="panel-head"><div><h3>Expenses</h3><p class="muted">Record daily business expenses with useful details.</p></div><button class="btn primary" onclick="expenseForm()">+ Add Expense</button></div><div class="expense-kpi">${stat('Total Recorded',money(total),expenses.length+' entries')}</div><div class="table-wrap" style="margin-top:14px"><table><thead><tr><th>Date</th><th>Category</th><th>Description</th><th>Payment</th><th class="num">Amount</th><th>Action</th></tr></thead><tbody>${expenses.map(e=>`<tr><td>${e.expense_date}</td><td>${esc(e.category)}</td><td>${esc(e.description)}</td><td>${esc(e.payment_method||'Cash')}</td><td class="num">${money(e.amount)}</td><td><div class="actions"><button class="btn light" onclick="expenseForm('${e.id}')">Edit</button><button class="btn danger" onclick="deleteExpense('${e.id}')">Delete</button></div></td></tr>`).join('')||'<tr><td colspan="6" class="empty">No expenses recorded yet.</td></tr>'}</tbody></table></div></div><div class="panel"><h3>Expense Summary</h3><p class="muted">Common categories for easier reporting.</p>${cats.map(c=>`<div class="summary-row"><span>${c}</span><b>${money(expenses.filter(e=>e.category===c).reduce((a,e)=>a+Number(e.amount||0),0))}</b></div>`).join('')}</div></div>`}
function expenseForm(id){if(!canAccessPage('expenses')){toast('Admin access required.','error');return;}const e=expenses.find(x=>x.id===id)||{};const cats=['Ingredients','Supplies','Transportation','Utilities','Staff','Equipment','Rent','Maintenance','Other'];modal(id?'Edit Expense':'Add Expense',`<form id="expenseForm"><div class="field-grid"><div class="field"><label>Date<input name="expense_date" type="date" required value="${e.expense_date||today()}"></label></div><div class="field"><label>Category<select name="category">${cats.map(c=>`<option ${e.category===c?'selected':''}>${c}</option>`).join('')}</select></label></div><div class="field"><label>Description<input name="description" required value="${esc(e.description||'')}" placeholder="e.g. Cooking oil, delivery fare"></label></div><div class="field"><label>Amount<input name="amount" type="number" min="0.01" step="0.01" required value="${e.amount??''}" placeholder="0.00"></label></div><div class="field"><label>Payment Method<select name="payment_method">${['Cash','GCash','Maya','Card','Other'].map(c=>`<option ${e.payment_method===c?'selected':''}>${c}</option>`).join('')}</select></label></div><div class="field"><label>Reference No. <input name="reference_no" value="${esc(e.reference_no||'')}" placeholder="Optional receipt/reference"></label></div></div><button class="btn primary wide">Save Expense</button></form>`);$('expenseForm').onsubmit=async ev=>{ev.preventDefault();const f=new FormData(ev.target),data={expense_date:f.get('expense_date'),category:f.get('category'),description:f.get('description').trim(),amount:Number(f.get('amount')),payment_method:f.get('payment_method'),reference_no:f.get('reference_no').trim()||null,added_by:user.id};const res=id?await sb.from('expenses').update(data).eq('id',id):await sb.from('expenses').insert(data);if(res.error)toast(res.error.message,'error');else{closeModal();await loadAll();toast('Expense saved.','success')}}}
async function deleteExpense(id){if(!canAccessPage('expenses')){toast('Admin access required.','error');return;}if(!confirm('Delete this expense?'))return;const {error}=await sb.from('expenses').delete().eq('id',id);if(error)toast(error.message,'error');else{await loadAll();toast('Expense deleted.')}}

function staffPage(){
  if(role!=='admin')return '<div class="panel"><h3>Admin only</h3><p class="muted">Staff account registration is available only to Admin accounts.</p></div>';
  return `<div class="grid two">
    <div class="panel">
      <div class="panel-head"><div><h3>Register Staff Account</h3><p class="muted">Create a Staff login using only a username and password.</p></div></div>
      <form id="staffRegisterForm" class="form-grid">
        <label>Username<input id="staffUsername" type="text" required minlength="3" maxlength="32" autocomplete="off" placeholder="e.g. cashier1"></label>
        <label>Password<input id="staffPassword" type="password" required minlength="6" autocomplete="new-password" placeholder="At least 6 characters"></label>
        <label>Confirm password<input id="staffConfirm" type="password" required minlength="6" autocomplete="new-password" placeholder="Re-enter password"></label>
        <div class="actions"><button class="btn primary" id="staffRegisterBtn" type="submit">Create Staff</button></div>
        <div id="staffRegisterError" class="error"></div><div id="staffRegisterMessage" class="success-text"></div>
      </form>
    </div>
    <div class="panel">
      <div class="panel-head"><div><h3>Staff Accounts</h3><p class="muted">Usernames and assigned roles.</p></div></div>
      <div class="table-wrap"><table><thead><tr><th>Username</th><th>Role</th><th>Created</th></tr></thead><tbody id="staffUsersBody"><tr><td colspan="3" class="empty">Loading users...</td></tr></tbody></table></div>
    </div>
  </div>`;
}
async function loadStaffProfiles(){
  if(role!=='admin'||page!=='staff')return;
  const body=$('staffUsersBody'); if(!body)return;
  const {data,error}=await sb.from('profiles').select('username,role,created_at').order('created_at',{ascending:false});
  if(error){body.innerHTML=`<tr><td colspan="3" class="empty">${esc(error.message)}</td></tr>`;return;}
  body.innerHTML=(data||[]).map(u=>`<tr><td><b>${esc(u.username||'')}</b></td><td><span class="badge">${esc(String(u.role||'staff').toUpperCase())}</span></td><td>${u.created_at?new Date(u.created_at).toLocaleString('en-PH'):''}</td></tr>`).join('')||'<tr><td colspan="3" class="empty">No users found.</td></tr>';
}
async function registerStaffFromAdmin(e){
  e.preventDefault();
  if(role!=='admin'){toast('Admin access required.','error');return;}
  const uname=$('staffUsername').value.trim().toLowerCase(),password=$('staffPassword').value,confirm=$('staffConfirm').value;
  const err=$('staffRegisterError'),msg=$('staffRegisterMessage'),btn=$('staffRegisterBtn');err.textContent='';msg.textContent='';
  if(!/^[a-z0-9._-]{3,32}$/.test(uname)){err.textContent='Username must be 3-32 characters using letters, numbers, dot, underscore, or hyphen.';return;}
  if(password.length<6){err.textContent='Password must be at least 6 characters.';return;}
  if(password!==confirm){err.textContent='Passwords do not match.';return;}
  btn.disabled=true;btn.textContent='Creating...';
  try{
    const {data:sessionData}=await sb.auth.getSession();
    const token=sessionData?.session?.access_token;
    if(!token)throw new Error('Admin session expired. Please sign in again.');
    const res=await fetch((cfg.url||'').replace(/\/$/,'')+'/functions/v1/create-staff',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+token,'apikey':cfg.anonKey||''},body:JSON.stringify({username:uname,password})});
    const payload=await res.json().catch(()=>({}));
    if(!res.ok)throw new Error(payload.error||'Could not create Staff account.');
    $('staffRegisterForm').reset();msg.textContent='Staff account created successfully.';await loadStaffProfiles();
  }catch(ex){err.textContent=ex.message||'Could not create Staff account.';}
  btn.disabled=false;btn.textContent='Create Staff';
}

function reports(){
  if(!canAccessPage('reports'))return '<div class="panel"><h3>Admin only</h3><p class="muted">Reports are available to Admin accounts.</p></div>';
  const completed=sales.filter(s=>!['refunded','void'].includes(s.status));
  const revenue=completed.reduce((a,s)=>a+Number(s.total||0),0);
  const pwdCount=completed.filter(s=>s.pwd_discount).length;
  const pwdAmount=completed.filter(s=>s.pwd_discount).reduce((a,s)=>a+Number(s.discount||0),0);
  const expenseTotal=expenses.reduce((a,e)=>a+Number(e.amount||0),0);
  const byPayment={};
  completed.forEach(s=>{const k=s.payment_method||'Other';byPayment[k]=(byPayment[k]||0)+Number(s.total||0);});
  return `<div class="grid stats">${stat('Total Sales',money(revenue),completed.length+' completed transaction(s)')}${stat('PWD Discounts',money(pwdAmount),pwdCount+' transaction(s)')}${stat('Total Expenses',money(expenseTotal),expenses.length+' expense(s)')}${stat('Net Sales',money(revenue-expenseTotal),'Sales minus expenses')}</div><div class="grid two" style="margin-top:16px"><div class="panel"><h3>Payment Summary</h3>${Object.keys(byPayment).length?Object.entries(byPayment).map(([k,v])=>`<div class="summary-row"><span>${esc(k)}</span><b>${money(v)}</b></div>`).join(''):'<div class="empty">No sales yet.</div>'}</div><div class="panel"><h3>PWD Discount Summary</h3><p class="muted">Fixed PWD discount rate: 20%</p><div class="summary-row"><span>PWD transactions</span><b>${pwdCount}</b></div><div class="summary-row"><span>Total discount given</span><b>${money(pwdAmount)}</b></div></div></div>`;
}

function settings(){if(!canAccessPage('settings'))return '<div class="panel"><h3>Admin only</h3><p class="muted">Settings are available to Admin accounts.</p></div>';return `<div class="grid two"><div class="panel"><h3>Store Settings</h3><div class="field"><label>Store Name<input id="storeName" value="${esc(localStorage.getItem('crx_store')||'Cash Register X')}"></label></div><button class="btn primary" onclick="localStorage.setItem('crx_store',$('storeName').value);toast('Store name saved.')">Save</button></div><div class="panel"><h3>Supabase Connection</h3><p class="muted">This app uses your Supabase project directly from the browser. Only use the publishable/anon key here. Never put a service-role secret in config.js.</p><p><b>Project:</b> ${esc(cfg.url||'Not configured')}</p><p><b>Role:</b> ${role.toUpperCase()}</p><button class="btn light" onclick="loadAll()">Test / Refresh Data</button></div><div class="panel"><h3>Data Tools</h3><div class="actions"><button class="btn success" onclick="exportSales()">Export Sales</button><button class="btn success" onclick="exportInventory()">Export Inventory</button><button class="btn success" onclick="exportExpenses()">Export Expenses</button></div></div></div>`}

function render(){
  if(!user)return;
  if(!canAccessPage(page))page='dashboard';
  applyRoleNavigation();
  const f={dashboard,pos,products:productsPage,inventory,sales:salesPage,expenses:expensesPage,reports,settings,staff:staffPage};
  try{
    if(typeof f[page]!=='function')throw new Error('Page renderer is unavailable: '+page);
    $('content').innerHTML=f[page]();
  }catch(err){
    console.error('Render error:',err);
    $('content').innerHTML=`<div class="panel"><h3>Unable to load this page</h3><p class="muted">${esc(err?.message||'Unknown error')}</p><button class="btn light" onclick="render()">Try Again</button></div>`;
  }
  if(page==='pos'){
    const s=$('posSearch');
    if(s){
      s.oninput=()=>{
        window.posSearch=s.value;
        const term=s.value.trim().toLowerCase();
        document.querySelectorAll('.product-btn').forEach(btn=>{
          const name=(btn.querySelector('b')?.textContent||'').toLowerCase();
          btn.style.display=(!term||name.includes(term))?'':'none';
        });
      };
    }
    const c=$('posCat');
    if(c)c.onchange=()=>{pagePosCategory=c.value;render()};
    const pwd=$('pwdDiscount');
    if(pwd)pwd.onchange=togglePwdDiscount;
  }
  if(page==='staff'){
    const form=$('staffRegisterForm');
    if(form)form.onsubmit=registerStaffFromAdmin;
    loadStaffProfiles();
  }
}

async function checkout(){
  if(!cart.length)return;

  // Snapshot the order so later UI changes cannot make checkout use a stale/zero total.
  const order=cart.map(i=>({
    product_id:i.product_id,
    name:i.name,
    price:Number(i.price)||0,
    qty:Number(i.qty)||1,
    unit:i.unit||'pcs'
  }));
  const subtotal=order.reduce((sum,i)=>sum+(i.price*i.qty),0);
  const pwdDiscount=!!window.pwdDiscount;
  const discount=pwdDiscountAmount(subtotal);
  const total=Math.max(0,subtotal-discount);

  modal('Complete Sale',`<form id="checkoutForm">
    <div class="checkout-total">
      <span>Total to pay</span>
      <strong id="checkoutTotal">${money(total)}</strong>
    </div>
    <div class="checkout-summary">
      ${order.map(i=>`<div class="summary-row"><span>${esc(i.name)} × ${formatQty(i.qty)}</span><b>${money(i.price*i.qty)}</b></div>`).join('')}
      ${pwdDiscount?`<div class="summary-row"><span>PWD Discount (20%)</span><b>−${money(discount)}</b></div>`:''}
      <div class="summary-row summary-total"><span>Total</span><b>${money(total)}</b></div>
    </div>
    <div class="field-grid">
      <div class="field"><label>Payment Method
        <select name="payment_method" id="paymentMethod">
          <option>Cash</option><option>GCash</option><option>Maya</option><option>Card</option><option>Other</option>
        </select>
      </label></div>
      <div class="field"><label>Amount Received
        <input name="received" id="received" type="number" min="${total}" step="0.01" value="${total}" inputmode="decimal">
      </label></div>
      <div class="field"><label>Change
        <input id="change" class="change-field" readonly value="${money(0)}">
      </label></div>
    </div>
    <div id="cashQuick" class="quick-pay">
      <button type="button" class="btn light" data-pay="${total}">Exact</button>
      <button type="button" class="btn light" data-pay="100">₱100</button>
      <button type="button" class="btn light" data-pay="200">₱200</button>
      <button type="button" class="btn light" data-pay="500">₱500</button>
    </div>
    <p class="checkout-note">Enter the amount received. Change is calculated automatically.</p>
    <button class="btn primary wide checkout-complete" type="submit">Complete Sale</button>
  </form>`);

  const form=$('checkoutForm'), received=$('received'), change=$('change');
  const method=$('paymentMethod'), quick=$('cashQuick'), complete=form?.querySelector('.checkout-complete');
  if(!form||!received||!change||!method)return;

  const updateChange=()=>{
    const r=Number(received.value)||0;
    change.value=money(Math.max(0,r-total));
  };

  const updatePaymentMode=()=>{
    const cash=method.value==='Cash';
    received.disabled=!cash;
    quick.classList.toggle('hidden',!cash);
    if(!cash){
      received.value=total;
      change.value=money(0);
    }else updateChange();
  };

  received.addEventListener('input',updateChange);
  method.addEventListener('change',updatePaymentMode);
  quick.querySelectorAll('[data-pay]').forEach(b=>{
    b.addEventListener('click',()=>{
      received.value=Math.max(total,Number(b.dataset.pay)||total);
      updateChange();
    });
  });
  updatePaymentMode();

  form.addEventListener('submit',async e=>{
    e.preventDefault();
    if(complete?.disabled)return;

    const fd=new FormData(form);
    const receivedValue=method.value==='Cash'?Number(fd.get('received')):total;
    if(method.value==='Cash' && receivedValue<total){
      toast('Amount received is less than total.','error');
      received.focus();
      return;
    }

    if(complete)complete.disabled=true;
    const sale={
      sale_date:today(),
      subtotal,
      discount,
      total,
      payment_method:fd.get('payment_method'),
      pwd_discount:pwdDiscount,
      status:'completed',
      cashier_id:user.id,
      amount_received:receivedValue,
      change_amount:Math.max(0,receivedValue-total)
    };

    const ins=await sb.from('sales').insert(sale).select().single();
    if(ins.error){
      toast(ins.error.message,'error');
      if(complete)complete.disabled=false;
      return;
    }

    const lineResults=await Promise.all(order.map(item=>sb.from('sale_items').insert({
      sale_id:ins.data.id,
      product_id:item.product_id,
      product_name:item.name,
      quantity:item.qty,
      unit_price:item.price,
      line_total:item.price*item.qty
    })));

    const lineError=lineResults.find(r=>r.error);
    if(lineError){
      toast(lineError.error.message,'error');
      if(complete)complete.disabled=false;
      return;
    }



    closeModal();
    cart=[];
    window.pwdDiscount=false;
    // Refresh after the transaction is complete; this is intentionally outside
    // the button/input interaction path so typing remains instant.
    await loadAll();
    toast(`Sale completed. Change: ${money(Math.max(0,receivedValue-total))}`,'success');
  });
}

function exportXlsx(rows,name,sheet){if(!rows.length){toast('No data to export.','error');return}const ws=XLSX.utils.json_to_sheet(rows),wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,sheet);XLSX.writeFile(wb,name)}
function exportSales(){exportXlsx(sales.map(s=>({Receipt:String(s.id),Date:s.sale_date,Payment:s.payment_method,Subtotal:s.subtotal,PWD_Discount:s.pwd_discount?'20%':'',Discount_Amount:s.discount,Total:s.total,Status:s.status})), 'Sales_Report.xlsx','Sales')}
function exportInventory(){exportXlsx(stocks.map(s=>({Product:products.find(p=>p.id===s.product_id)?.name||s.name,SKU:products.find(p=>p.id===s.product_id)?.sku||'',Quantity:s.quantity,Unit:s.unit||'pcs','Low Limit':s.low_limit})), 'Inventory_Report.xlsx','Inventory')}
function exportExpenses(){exportXlsx(expenses.map(e=>({Date:e.expense_date,Category:e.category,Description:e.description,Payment:e.payment_method||'Cash',Reference:e.reference_no||'',Amount:e.amount})), 'Expenses_Report.xlsx','Expenses')}
function printSales(){const rows=sales.filter(s=>!window.salesDate||s.sale_date===window.salesDate);const w=window.open('','_blank');w.document.write('<html><body><h1>Sales Report</h1><table border="1" cellspacing="0" cellpadding="7"><tr><th>Date</th><th>Payment</th><th>Total</th></tr>'+rows.map(s=>`<tr><td>${s.sale_date}</td><td>${esc(s.payment_method)}</td><td>${money(s.total)}</td></tr>`).join('')+'</table><script>window.print()<\/script></body></html>');w.document.close()}
async function importInventory(input){
  const file=input.files[0];
  if(!file)return;
  const workbook=XLSX.read(await file.arrayBuffer());
  const sheet=workbook.Sheets[workbook.SheetNames[0]];
  const data=XLSX.utils.sheet_to_json(sheet);
  const jobs=[];
  for(const r of data){
    const name=String(r.Product||r.Name||'').trim();
    const q=Number(r.Quantity);
    const p=products.find(x=>x.name.toLowerCase()===name.toLowerCase());
    if(!p||!Number.isFinite(q)||q<0)continue;
    const s=stocks.find(x=>x.product_id===p.id);
    const unit=String(r.Unit||'pcs').trim()||'pcs';
    const payload={quantity:q,unit,low_limit:Number(r['Low Limit'])||3};
    jobs.push(s
      ? sb.from('stocks').update(payload).eq('id',s.id)
      : sb.from('stocks').insert({product_id:p.id,...payload}));
  }
  await Promise.all(jobs);
  await loadAll();
  toast('Inventory import finished.','success');
  input.value='';
}

$('loginForm').onsubmit=async e=>{
  e.preventDefault();if(!valid())return;
  const b=$('loginBtn');b.disabled=true;b.textContent='Signing in...';$('loginError').textContent='';
  try{
    const uname=$('username').value.trim().toLowerCase();
    const {data:email,error:lookupError}=await sb.rpc('get_login_email',{p_username:uname});
    if(lookupError)throw lookupError;
    if(!email)throw new Error('Username not found.');
    const {data,error}=await sb.auth.signInWithPassword({email,password:$('password').value});
    if(error)throw error;
    await session(data.session);
  }catch(ex){$('loginError').textContent=ex.message||'Sign in failed.';}
  b.disabled=false;b.textContent='Sign in';
};
$('logout').onclick=async()=>await sb.auth.signOut();
$('refresh').onclick=()=>loadAll();

function openSidebar(){
  const sidebar=document.querySelector('.sidebar');
  const overlay=$('sidebarOverlay');
  const menu=$('menu');
  sidebar?.classList.add('open');
  overlay?.classList.add('show');
  overlay?.setAttribute('aria-hidden','false');
  if(menu){menu.textContent='×';menu.setAttribute('aria-label','Close navigation');menu.setAttribute('aria-expanded','true')}
  document.body.classList.add('nav-open');
}
function closeSidebar(){
  const sidebar=document.querySelector('.sidebar');
  const overlay=$('sidebarOverlay');
  const menu=$('menu');
  sidebar?.classList.remove('open');
  overlay?.classList.remove('show');
  overlay?.setAttribute('aria-hidden','true');
  if(menu){menu.textContent='☰';menu.setAttribute('aria-label','Open navigation');menu.setAttribute('aria-expanded','false')}
  document.body.classList.remove('nav-open');
}
function toggleSidebar(){
  if(window.innerWidth>1024)return;
  const sidebar=document.querySelector('.sidebar');
  sidebar?.classList.contains('open')?closeSidebar():openSidebar();
}
$('menu').onclick=toggleSidebar;
$('sidebarOverlay').onclick=closeSidebar;
document.querySelectorAll('.nav-btn,.mobile-nav-btn').forEach(b=>b.onclick=()=>setPage(b.dataset.page));
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeSidebar()});
window.addEventListener('resize',()=>{if(window.innerWidth>1024)closeSidebar()});
(async()=>{if(!valid())return;sb.auth.onAuthStateChange((_e,s)=>session(s));const {data}=await sb.auth.getSession();await session(data.session);$('todayLabel').textContent=new Date().toLocaleDateString('en-PH',{weekday:'long',year:'numeric',month:'long',day:'numeric'});if('serviceWorker' in navigator)navigator.serviceWorker.register('./sw.js').catch(console.warn)})();
window.setPage=setPage;window.render=render;window.addCart=addCart;window.changeQty=changeQty;window.changeQtyLive=changeQtyLive;window.togglePwdDiscount=togglePwdDiscount;window.removeCart=removeCart;window.clearCart=clearCart;window.checkout=checkout;window.productForm=productForm;window.deleteProduct=deleteProduct;window.categoryForm=categoryForm;window.deleteCategory=deleteCategory;window.stockForm=stockForm;window.setStock=setStock;window.deleteStock=deleteStock;window.expenseForm=expenseForm;window.deleteExpense=deleteExpense;window.receipt=receipt;window.refundSale=refundSale;window.exportSales=exportSales;window.exportInventory=exportInventory;window.exportExpenses=exportExpenses;window.printSales=printSales;window.importInventory=importInventory;window.closeModal=closeModal;
