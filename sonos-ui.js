(function () {

    const SONOS_API = 'https://anthonsen.net:3738';
    
    // ===== STATE =====
    let devices = JSON.parse(localStorage.getItem('sonosDevices') || '[]');
    let selected = localStorage.getItem('sonosDevice') || null;
    let isSonos = false;
    
    // ===== UI =====
    const btn = document.createElement('button');
    btn.innerText = '🔊';
    btn.style = `
    position:fixed;bottom:80px;right:15px;
    width:50px;height:50px;border-radius:50%;
    background:#222;color:#fff;border:none;
    font-size:20px;z-index:999;
    `;
    document.body.appendChild(btn);
    
    const modal = document.createElement('div');
    modal.style = `
    position:fixed;top:0;left:0;right:0;bottom:0;
    background:rgba(0,0,0,0.7);
    display:none;z-index:1000;
    `;
    modal.innerHTML = `
    <div style="background:#111;padding:20px;margin:50px auto;max-width:400px;border-radius:10px">
    <h3>Sonos</h3>
    
    <div id="list"></div>
    
    <input id="name" placeholder="Navn">
    <input id="ip" placeholder="IP">
    <button id="add">Legg til</button>
    
    <hr>
    
    <button id="useLocal">📱 Spill lokalt</button>
    <button id="close">Lukk</button>
    </div>
    `;
    document.body.appendChild(modal);
    
    // ===== RENDER =====
    function render() {
        const list = modal.querySelector('#list');
        list.innerHTML = '';
    
        devices.forEach(d => {
            const el = document.createElement('div');
            el.style = 'padding:5px;cursor:pointer';
    
            if (d.ip === selected) {
                el.style.background = '#333';
            }
    
            el.innerText = d.name + ' (' + d.ip + ')';
    
            el.onclick = () => {
                selected = d.ip;
                localStorage.setItem('sonosDevice', selected);
                render();
            };
    
            list.appendChild(el);
        });
    }
    
    // ===== EVENTS =====
    btn.onclick = () => {
        modal.style.display = 'block';
        render();
    };
    
    modal.querySelector('#close').onclick = () => {
        modal.style.display = 'none';
    };
    
    modal.querySelector('#add').onclick = () => {
        const name = modal.querySelector('#name').value.trim();
        const ip   = modal.querySelector('#ip').value.trim();
    
        if (!name || !ip) return;
    
        devices.push({name, ip});
        localStorage.setItem('sonosDevices', JSON.stringify(devices));
    
        modal.querySelector('#name').value = '';
        modal.querySelector('#ip').value = '';
    
        render();
    };
    
    modal.querySelector('#useLocal').onclick = async () => {
        if (!selected) return;
    
        await fetch(SONOS_API + '/stop', {
            method:'POST',
            headers:{'Content-Type':'application/json'},
            body: JSON.stringify({deviceId:selected})
        });
    
        isSonos = false;
    
        if (window._lastUrl) {
            new Audio(window._lastUrl).play();
        }
    
        modal.style.display = 'none';
    };
    
    // ===== HOVEDFUNKSJON =====
    window.playStream = async function(url) {
    
        window._lastUrl = url;
    
        if (!selected) {
            // ingen Sonos valgt → spill lokalt
            new Audio(url).play();
            return;
        }
    
        try {
            await fetch(SONOS_API + '/takeover', {
                method:'POST',
                headers:{'Content-Type':'application/json'},
                body: JSON.stringify({
                    deviceId: selected,
                    uri: url,
                    volume: 30
                })
            });
    
            isSonos = true;
    
        } catch(e) {
            console.log('Sonos feil → spiller lokalt');
            new Audio(url).play();
        }
    };
    
    })();