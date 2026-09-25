const API = "https://script.google.com/macros/s/AKfycbzKcfMXWKhdLhRZKNNhxjFxPZu8Pcs4OTqYxchHS4Ua4geP1lkqjv91giu7kftktbmH/exec";

const namaBulanArr = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
const currentDate = new Date();
const bulanBerjalan = namaBulanArr[currentDate.getMonth()] + " " + currentDate.getFullYear();

document.getElementById("judulBulanHeader").innerText = "JADWAL " + bulanBerjalan.toUpperCase();

// Variabel Global untuk Scanner & Status
let qr = null;
let sedangProses = false;
let lastScanTime = 0;
let streamSelfie = null;
let activeStaffId = "";
let userIP = "";
let isCheckingWifi = false; // Mencegah fungsi deteksi berjalan bertubi-tubi (Anti-Spam)

function switchTab(tabName, btn) {
    document.querySelectorAll('.container').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
    
    if(tabName === 'scanner') {
        document.getElementById('tab-scanner').classList.add('active');
    } else if(tabName === 'rekap') {
        document.getElementById('tab-rekap').classList.add('active');
        if(!window.loadedJadwal) { loadRekapBulanan(); }
    } else if(tabName === 'log') {
        document.getElementById('tab-log').classList.add('active');
        loadLogHariIni();
    } else if(tabName === 'peraturan') {
        document.getElementById('tab-peraturan').classList.add('active');
    } else if(tabName === 'admin') {
        document.getElementById('tab-admin').classList.add('active');
    }
    btn.classList.add('active');
}

async function cekPasswordAdmin(retries = 1) {
    let inputUser = document.getElementById("adminUsernameInput").value.trim();
    let inputVal = document.getElementById("adminPassInput").value.trim();
    let errorEl = document.getElementById("authError");
    let btnLogin = document.getElementById("btnLoginAdmin");
    
    if (!inputUser || !inputVal) {
        errorEl.style.display = "block";
        errorEl.innerText = "Username dan Password tidak boleh kosong!";
        return;
    }

    errorEl.style.display = "none";
    btnLogin.innerText = retries === 1 ? "Memeriksa..." : "Menghubungkan ulang...";
    btnLogin.disabled = true;

    try {
        let response = await fetch(API, {
            method: "POST",
            body: JSON.stringify({ action: "login", username: inputUser, password: inputVal })
        });
        
        let textData = await response.text();
        let res;
        try {
            res = JSON.parse(textData);
        } catch(e) {
            throw new Error("Respons server tidak valid.");
        }

        if (res && res.sukses) {
            localStorage.setItem("adminLoggedIn", "true");
            localStorage.setItem("adminNama", res.nama || inputUser);
            localStorage.setItem("adminUsername", inputUser);

            terapkanTampilanAdmin(res.nama || inputUser, inputUser);
        } else {
            errorEl.style.display = "block";
            errorEl.innerText = "❌ " + (res && res.pesan ? res.pesan : "Username atau Password Salah!");
        }
    } catch (err) {
        if (retries > 0) {
            errorEl.style.display = "block";
            errorEl.innerText = "⏳ Server sedang merespons (cold start), mencoba ulang otomatis...";
            setTimeout(() => cekPasswordAdmin(retries - 1), 2000);
            return;
        } else {
            errorEl.style.display = "block";
            errorEl.innerText = "❌ Gagal terhubung ke server. Periksa koneksi internet Anda.";
        }
    } finally {
        if (retries <= 0) {
            btnLogin.innerText = "Masuk";
            btnLogin.disabled = false;
        }
    }
}

function terapkanTampilanAdmin(namaLengkap, username) {
    window.adminLoginNama = username;
    
    let elSalam = document.getElementById("salamNamaAdmin");
    if (elSalam) {
        elSalam.innerText = namaLengkap;
    }

    document.getElementById("authOverlay").style.display = "none";
    document.getElementById("adminContentBody").style.display = "block";
    
    const daftarAdminUtama = ["rifai", "andri", "fadil", "yasin"];
    const kotakUpdateIp = document.getElementById("kotakUpdateIpWifi");
    
    if (daftarAdminUtama.includes(username.toLowerCase())) {
        if (kotakUpdateIp) kotakUpdateIp.style.display = "block";
        muatIpAdmin();
    } else {
        if (kotakUpdateIp) kotakUpdateIp.style.display = "none";
    }
}

function logoutAdmin() {
    if (confirm("Apakah Anda yakin ingin keluar dari akun admin?")) {
        localStorage.removeItem("adminLoggedIn");
        localStorage.removeItem("adminNama");
        localStorage.removeItem("adminUsername");
        
        document.getElementById("authOverlay").style.display = "block";
        document.getElementById("adminContentBody").style.display = "none";
        document.getElementById("adminPassInput").value = "";
        document.getElementById("adminUsernameInput").value = "";
    }
}

function muatIpAdmin() {
    fetch("https://api.ipify.org?format=json")
        .then(r => r.json())
        .then(data => {
            window.adminMyIp = data.ip;
            document.getElementById("adminCurrentIp").innerText = "IP Publik: " + window.adminMyIp;
        })
        .catch(err => {
            document.getElementById("adminCurrentIp").innerText = "Gagal mendeteksi IP";
        });
}

function togglePasswordVisibilitas() {
    const passInput = document.getElementById("adminPassInput");
    const iconMata = event.target;
    if (passInput.type === "password") {
        passInput.type = "text";
        iconMata.innerText = "🙈";
    } else {
        passInput.type = "password";
        iconMata.innerText = "👁️";
    }
}

function updateIpKantorDariTab() {
    if (!window.adminMyIp) {
        alert("IP belum terdeteksi, mohon tunggu sebentar...");
        return;
    }

    let msg = document.getElementById("statusMsgAdmin");
    let btnUpdate = event.target;
    
    btnUpdate.disabled = true;
    btnUpdate.style.opacity = "0.6";

    msg.style.color = "#1e293b";
    msg.innerText = "Sedang memperbarui IP Wi-Fi kantor...";

    let targetTerpilih = document.getElementById("targetWifi").value;
    let namaStaffAktif = window.adminLoginNama || "Manual Staff";

    fetch(API, {
        method: "POST",
        body: JSON.stringify({ 
            action: "updateWifi", 
            ip: window.adminMyIp, 
            target: targetTerpilih,
            namaStaff: namaStaffAktif 
        })
    })
    .then(r => r.json())
    .then(res => {
        if(res.sukses) {
            msg.style.color = "#059669";
            msg.innerText = "✅ " + res.pesan;
        } else {
            msg.style.color = "#dc2626";
            msg.innerText = "❌ " + res.pesan;
        }
    })
    .catch(err => {
        msg.style.color = "#dc2626";
        msg.innerText = "❌ Terjadi kesalahan koneksi ke server.";
    })
    .finally(() => {
        btnUpdate.disabled = false;
        btnUpdate.style.opacity = "1";
    });
}

function loadRekapBulanan(retries = 1) {
    const container = document.getElementById('rekapContent');
    if (!container) return;
    container.innerHTML = '<div style="text-align:center; padding:30px; color:#64748b;">⏳ Sedang Memuat jadwal bulanan...</div>';

    fetch(API, {
        method: "POST",
        body: JSON.stringify({ action: "getRekapBulanan", bulan: bulanBerjalan })
    })
    .then(async r => {
        let text = await r.text();
        try {
            return JSON.parse(text);
        } catch (e) {
            throw new Error("Format respons server tidak valid.");
        }
    })
    .then(res => {
        if(!res || !res.sukses) {
            throw new Error(res && res.pesan ? res.pesan : "Gagal memuat rekap.");
        }
        window.loadedJadwal = true;
        let rows = res.data;
        if (!rows || rows.length === 0) {
            container.innerHTML = '<div style="text-align:center; padding:25px; color:#64748b;">Data jadwal kosong.</div>';
            return;
        }

        let html = '<table class="rekap-table" id="tabelJadwal">';
        let counterNo = 1;
        
        rows.forEach((row, rowIndex) => {
            if(rowIndex === 0 && (!row[1] || row[1] === "")) return;

            let textKolomB = row[1] !== null ? String(row[1]).trim() : '';
            let isBarisKhusus = textKolomB.includes("Daftar absen harian") || textKolomB.includes("Total Staff yang Online");
            let isBarisKosong = (rowIndex > 1 && textKolomB === '' && !isBarisKhusus);

            if (isBarisKosong) {
                html += '<tr style="height: 6px; line-height: 0; font-size: 0px;">';
            } else {
                html += '<tr>';
            }

           if (rowIndex === 0 || rowIndex === 1) {
                let tag = 'th';
                let noHeader = rowIndex === 0 ? 'No' : '';
                html += `<${tag}>${noHeader}</${tag}>`;
            } else {
                let tag = 'td';
                let namaStaffCell = textKolomB;
                let nomorUrut = '';
                
                if (namaStaffCell !== '' && counterNo <= 35 && !isBarisKhusus) {
                    nomorUrut = counterNo;
                    counterNo++;
                }
                let noUrutFinal = isBarisKhusus ? '' : nomorUrut;
                let extraStyleNo = isBarisKosong ? 'style="padding: 0; height: 6px; font-size: 0px;"' : '';
                html += `<${tag} ${extraStyleNo}><b>${noUrutFinal}</b></${tag}>`;
            }

            row.forEach((cell, colIndex) => {
                if (colIndex === 0) return;
                if (colIndex === row.length - 1) return;
                let tag = rowIndex === 0 || rowIndex === 1 ? 'th' : 'td';
                let cellText = cell !== null ? String(cell).trim() : '';
                
                if (rowIndex === 0 && colIndex === 1) {
                    cellText = '<div style="display: flex; align-items: center; justify-content: center; height: 100%;">Nama</div>';
                }
                if (rowIndex === 1 && colIndex === 1) {
                    cellText = "";
                }
                    
                if (tag === 'td' && colIndex === 1 && cellText !== '' && !isBarisKhusus && !isBarisKosong) {
                    cellText = `<span class="badge-nama-kapsul">${cellText}</span>`;
                }

                if (rowIndex === 1 && colIndex > 1) {
                    cellText = formatTanggalHeaderClean(cellText);
                } else if (cellText.includes && cellText.includes('T') && cellText.includes('Z') && cellText.length > 15) {
                    let d = new Date(cellText);
                    if (!isNaN(d.getTime())) cellText = d.getDate();
                }

                if (tag === 'td' && colIndex > 1 && cellText !== '' && !isBarisKhusus && !isBarisKosong) {
                    let upperVal = String(cellText).toUpperCase();
                    let badgeClass = 'badge-shift ';
                    
                    const isJmlOn = colIndex === row.length - 2;
                    const isUangMakan = colIndex === row.length - 1;

                    if (isJmlOn) {
                        badgeClass += 'badge-jmlon';
                    } else if (isUangMakan) {
                        badgeClass += 'badge-uangmakan';
                        let num = Number(cellText.replace(/[^0-9]/g, ''));
                        if (!isNaN(num) && num > 0) {
                            cellText = "Rp " + num.toLocaleString('id-ID');
                        }
                    } else if (upperVal.includes('S1') || upperVal.includes('S2') || upperVal.includes('S3')) {
                        badgeClass += 'shift-s1';
                    } else if (upperVal.includes('OFF') || upperVal.includes('LIBUR') || upperVal === 'L') {
                        badgeClass += 'shift-off';
                    } else if (upperVal.includes('CUTI') || upperVal.includes('TLT') || upperVal === 'T' || upperVal.includes('CN')) {
                        badgeClass += 'shift-cuti';
                    } else {
                        badgeClass += 'shift-wfh';
                    }
                    cellText = `<span class="${badgeClass}">${cellText}</span>`;
                }

                let isTotalOnlineRow = textKolomB.includes("Total Staff yang Online");
                let styleBg = isBarisKhusus ? 'style="background-color: #f1f5f9 !important; font-weight: bold;"' : (isBarisKosong ? 'style="padding: 0; height: 6px; font-size: 0px; background-color: #e2e8f0 !important;"' : '');
                
                if (isTotalOnlineRow && colIndex > 2 && cellText !== '') {
                    cellText = `<span class="badge-shift shift-s1" style="font-weight: bold;">${cellText}</span>`;
                }

                html += `<${tag} ${styleBg}>${cellText}</${tag}>`;
            });
            html += '</tr>';
        });                
        html += '</table>';
        container.innerHTML = html;
    })
    .catch(err => { 
        if (retries > 0) {
            container.innerHTML = `<div style="text-align:center; padding:25px; color:#475569;">⚠️ Koneksi lambat, mencoba memuat ulang otomatis...</div>`;
            setTimeout(() => loadRekapBulanan(retries - 1), 2000);
        } else {
            container.innerHTML = `<div style="text-align:center; padding:25px; color:#dc2626;">❌ Terjadi kesalahan koneksi ke server.<br><br><button onclick="loadRekapBulanan(1)" style="background:#2563eb; color:white; border:none; padding:8px 16px; border-radius:6px; cursor:pointer; font-weight:bold;">🔄 Coba Muat Ulang Jadwal</button></div>`; 
        }
    });
}

function loadLogHariIni(retries = 1) {
    const container = document.getElementById('logContent');
    container.innerHTML = "Memuat log absensi hari ini...";

    fetch(API, {
        method: "POST",
        body: JSON.stringify({ action: "getLogHariIni" })
    })
    .then(r => r.json())
    .then(res => {
        if(!res.sukses) {
            throw new Error(res.pesan || "Gagal memuat log.");
        }
        let rows = res.data;
        if(!rows || rows.length <= 1) {
            container.innerHTML = "<div style='text-align:center; padding:20px; color:#64748b;'>Belum ada staff yang melakukan scan absen hari ini.</div>";
            return;
        }

        let totalData = rows.length - 1;
        let html = '<table class="rekap-table" id="tabelLog">';
        
        rows.forEach((row, rowIndex) => {
            html += '<tr>';
            if (rowIndex === 0) {
                html += `<th>No</th>`;
            } else {
                let nomorUrut = totalData - (rowIndex - 1);
                html += `<td><b>${nomorUrut}</b></td>`;
            }

            row.forEach((cell, colIndex) => {
                if (colIndex === 1) return; 
                if (colIndex === 0 && rowIndex > 0) return; 
                if (colIndex === 0 && rowIndex === 0) {
                    return; 
                }

                let cellText = cell !== null ? String(cell).trim() : '';
                let tag = rowIndex === 0 ? 'th' : 'td';

                if (tag === 'td') {
                    if (colIndex === 2 && cellText !== "") {
                        cellText = `<span class="badge-nama-kapsul" style="display:block; text-align:center;">${cellText}</span>`;
                        
                        let tanggalAsli = row[0] !== null ? String(row[0]).trim() : '';
                        cellText += `</td><td><span class="badge-shift" style="background:#f1f5f9; color:#334155; font-weight:600;">${tanggalAsli}</span>`;
                    }
                    else if ((colIndex === 3 || colIndex === 4) && cellText !== "") {
                        cellText = `<span class="badge-kapsul time-text">${cellText}</span>`;
                    }
                    else if (colIndex === 5) {
                        let upperVal = cellText.toUpperCase();
                        let badgeClass = "badge-shift ";
                        if (upperVal.includes("TERLAMBAT")) {
                            badgeClass += "shift-off";
                        } else if (upperVal.includes("MALAM")) {
                            badgeClass += "shift-s3";
                        } else {
                            badgeClass += "badge-hadir";
                        }
                        cellText = `<span class="${badgeClass}">${cellText}</span>`;
                    }
                    else if (colIndex === 6) {
                        if (cellText !== "") {
                            cellText = `<span class="badge-shift badge-wifi">📶 ${cellText}</span>`;
                        }
                    }
                    else if (colIndex === 7) {
                        if (cellText && cellText.trim() !== "" && cellText !== "Tanpa Foto") {
                            let rawVal = cellText.trim();
                            let fileId = "";
                            if (rawVal.includes("id=")) {
                                try {
                                    const urlParams = new URLSearchParams(rawVal.split('?')[1]);
                                    fileId = urlParams.get('id');
                                } catch(e) {}
                            } else if (rawVal.includes("/d/")) {
                                const parts = rawVal.split('/d/');
                                if (parts[1]) fileId = parts[1].split('/')[0];
                            } else {
                                fileId = rawVal;
                            }

                            if (fileId && fileId.length >= 10) {
                                let thumbUrl = `https://lh3.googleusercontent.com/d/${fileId}=s220`;
                                cellText = `
                                    <div style="position: relative; display: inline-block; cursor: pointer;" onclick="openImageModal('${fileId}')" title="Klik untuk memperbesar foto">
                                        <img src="${thumbUrl}" alt="Selfie" style="width: 40px; height: 40px; object-fit: cover; border-radius: 50%; border: 2px solid #38bdf8; box-shadow: 0 2px 5px rgba(0,0,0,0.15);" onerror="this.onerror=null; this.src='https://drive.google.com/uc?export=view&id=${fileId}';">
                                        <span style="position: absolute; bottom: 0; right: 0; background: #2563eb; color: white; font-size: 9px; width: 14px; height: 14px; border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 1px solid white;">📷</span>
                                    </div>`;
                            } else {
                                cellText = `<span class="badge-shift" style="background-color: #f1f5f9; color: #475569;">📷 Ada</span>`;
                            }
                        } else {
                            cellText = `<span class="badge-shift" style="background-color: #f8fafc; color: #94a3b8;">Tanpa Foto</span>`;
                        }
                    }
                    else if (colIndex === 8) {
                        let upperVal = cellText.toUpperCase();
                        let bClass = "shift-s1";
                        if (upperVal.includes("MALAM")) bClass = "shift-s3";
                        cellText = `<span class="badge-shift ${bClass}">${cellText}</span>`;
                    }
                    else if (colIndex === 9) {
                        let num = Number(cellText.replace(/[^0-9]/g, ''));
                        let rpText = (!isNaN(num) && num > 0) ? "Rp " + num.toLocaleString('id-ID') : "Rp 0";
                        cellText = `<span class="badge-shift badge-uangmakan">${rpText}</span>`;
                    }
                } else if (tag === 'th') {
                    if (colIndex === 2) {
                        cellText = "Nama Staff";
                        cellText += `</th><th>Tanggal`;
                    } else if (colIndex === 7) {
                        cellText = "Foto Selfie";
                    }
                }

                html += `<tag style="${colIndex === 2 ? 'text-align:center;' : ''}">${cellText}</tag>`.replace('<tag', `<${tag}`).replace('</tag>', `</${tag}>`);
            });
            html += '</tr>';
        });
        html += '</table>';
        container.innerHTML = html;
    })
    .catch(err => { 
        if (retries > 0) {
            container.innerHTML = "<div style='text-align:center; padding:20px; color:#475569;'>⚠️ Mencoba memuat ulang log otomatis...</div>";
            setTimeout(() => loadLogHariIni(retries - 1), 2000);
        } else {
            container.innerHTML = "❌ Terjadi kesalahan koneksi ke server."; 
        }
    });
}

function openImageModal(fileIdOrUrl) {
    const modal = document.getElementById('imageModal');
    const modalImg = document.getElementById('modalImg');
    
    if (!fileIdOrUrl) return;

    let fileId = String(fileIdOrUrl).trim();
    if (fileId.includes("id=")) {
        try {
            const urlParams = new URLSearchParams(fileId.split('?')[1]);
            fileId = urlParams.get('id');
        } catch(e) {}
    } else if (fileId.includes("/d/")) {
        const parts = fileId.split('/d/');
        if (parts[1]) fileId = parts[1].split('/')[0];
    }

    let finalUrl = fileId.length >= 10 && !fileId.startsWith("http")
        ? `https://lh3.googleusercontent.com/d/${fileId}=s1000`
        : fileId;

    modalImg.src = finalUrl;
    modal.style.display = 'flex';
}

function closeImageModal() {
    const modal = document.getElementById('imageModal');
    if (modal) modal.style.display = 'none';
}

function filterTabelJadwal() {
    let input = document.getElementById('searchNamaJadwal').value.toLowerCase();
    let table = document.getElementById('tabelJadwal');
    if(!table) return;
    let tr = table.getElementsByTagName('tr');
    for (let i = 2; i < tr.length; i++) {
        let tdNama = tr[i].getElementsByTagName('td')[1];
        if (tdNama) {
            let txt = tdNama.textContent || tdNama.innerText;
            tr[i].style.display = txt.toLowerCase().indexOf(input) > -1 ? "" : "none";
        }
    }
}

let searchTimeout = null;

function filterTabelLog() {
    let input = document.getElementById('searchLog').value.trim();
    clearTimeout(searchTimeout);

    if (input === "") {
        loadLogHariIni();
        return;
    }

    searchTimeout = setTimeout(() => {
        jalankanPencarianRiwayat(input);
    }, 400);
}

function jalankanPencarianRiwayat(keyword) {
    const container = document.getElementById('logContent');
    container.innerHTML = `<div style='text-align:center; padding:20px; color:#64748b;'>🔍 Mencari riwayat untuk "${keyword}"...</div>`;

    fetch(API, {
        method: "POST",
        body: JSON.stringify({ action: "cariRiwayatStaff", keyword: keyword })
    })
    .then(r => r.json())
    .then(res => {
        if(!res.sukses) {
            throw new Error(res.pesan || "Gagal mencari riwayat.");
        }
        let rows = res.data;
        if(!rows || rows.length <= 1) {
            container.innerHTML = `<div style='text-align:center; padding:20px; color:#64748b;'>Tidak ditemukan riwayat absensi untuk "${keyword}" di bulan ini.</div>`;
            return;
        }

        let totalData = rows.length - 1;
        let html = '<table class="rekap-table" id="tabelLog">';
        
     rows.forEach((row, rowIndex) => {
            html += '<tr>';
            if (rowIndex === 0) {
                html += `<th>No</th>`;
            } else {
                let nomorUrut = rowIndex;
                html += `<td><b>${nomorUrut}</b></td>`;
            }

            row.forEach((cell, colIndex) => {
                if (colIndex === 1) return; 
                if (colIndex === 0) return; 

                let cellText = cell !== null ? String(cell).trim() : '';
                let tag = rowIndex === 0 ? 'th' : 'td';

                if (tag === 'td') {
                    if (colIndex === 2 && cellText !== "") {
                        cellText = `<span class="badge-nama-kapsul" style="display:block; text-align:center;">${cellText}</span>`;
                        
                        let tanggalAsli = row[0] !== null ? String(row[0]).trim() : '';
                        cellText += `</td><td><span class="badge-shift" style="background:#f1f5f9; color:#334155; font-weight:600;">${tanggalAsli}</span>`;
                    }
                    else if ((colIndex === 3 || colIndex === 4) && cellText !== "") {
                        cellText = `<span class="badge-kapsul time-text">${cellText}</span>`;
                    }
                    else if (colIndex === 5) {
                        let upperVal = cellText.toUpperCase();
                        let badgeClass = "badge-shift ";
                        if (upperVal.includes("TERLAMBAT")) {
                            badgeClass += "shift-off";
                        } else if (upperVal.includes("MALAM")) {
                            badgeClass += "shift-s3";
                        } else {
                            badgeClass += "badge-hadir";
                        }
                        cellText = `<span class="${badgeClass}">${cellText}</span>`;
                    }
                    else if (colIndex === 6) {
                        if (cellText !== "") {
                            cellText = `<span class="badge-shift badge-wifi">📶 ${cellText}</span>`;
                        }
                    }
                    else if (colIndex === 7) {
                        if (cellText && cellText.trim() !== "" && cellText !== "Tanpa Foto") {
                            let rawVal = cellText.trim();
                            let fileId = "";
                            if (rawVal.includes("id=")) {
                                try {
                                    const urlParams = new URLSearchParams(rawVal.split('?')[1]);
                                    fileId = urlParams.get('id');
                                } catch(e) {}
                            } else if (rawVal.includes("/d/")) {
                                const parts = rawVal.split('/d/');
                                if (parts[1]) fileId = parts[1].split('/')[0];
                            } else {
                                fileId = rawVal;
                            }

                            if (fileId && fileId.length >= 10) {
                                let thumbUrl = `https://lh3.googleusercontent.com/d/${fileId}=s220`;
                                cellText = `
                                    <div style="position: relative; display: inline-block; cursor: pointer;" onclick="openImageModal('${fileId}')" title="Klik untuk memperbesar foto">
                                        <img src="${thumbUrl}" alt="Selfie" style="width: 40px; height: 40px; object-fit: cover; border-radius: 50%; border: 2px solid #38bdf8; box-shadow: 0 2px 5px rgba(0,0,0,0.15);" onerror="this.onerror=null; this.src='https://drive.google.com/uc?export=view&id=${fileId}';">
                                        <span style="position: absolute; bottom: 0; right: 0; background: #2563eb; color: white; font-size: 9px; width: 14px; height: 14px; border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 1px solid white;">📷</span>
                                    </div>`;
                            } else {
                                cellText = `<span class="badge-shift" style="background-color: #f1f5f9; color: #475569;">📷 Ada</span>`;
                            }
                        } else {
                            cellText = `<span class="badge-shift" style="background-color: #f8fafc; color: #94a3b8;">Tanpa Foto</span>`;
                        }
                    }
                    else if (colIndex === 8) {
                        let upperVal = cellText.toUpperCase();
                        let bClass = "shift-s1";
                        if (upperVal.includes("MALAM")) bClass = "shift-s3";
                        cellText = `<span class="badge-shift ${bClass}">${cellText}</span>`;
                    }
                    else if (colIndex === 9) {
                        let num = Number(cellText.replace(/[^0-9]/g, ''));
                        let rpText = (!isNaN(num) && num > 0) ? "Rp " + num.toLocaleString('id-ID') : "Rp 0";
                        cellText = `<span class="badge-shift badge-uangmakan">${rpText}</span>`;
                    }
                } else if (tag === 'th') {
                    if (colIndex === 2) {
                        cellText = "Nama Staff";
                        cellText += `</th><th>Tanggal`;
                    }
                    else if (colIndex === 7) cellText = "Foto Selfie";
                }

                html += `<tag style="${colIndex === 2 ? 'text-align:center;' : ''}">${cellText}</tag>`.replace('<tag', `<${tag}`).replace('</tag>', `</${tag}>`);
            });
            html += '</tr>';
        });
        html += '</table>';
        container.innerHTML = html;
    })
    .catch(err => {
        container.innerHTML = `<div style='text-align:center; padding:20px; color:#dc2626;'>❌ Gagal memuat riwayat: ${err.message}</div>`;
    });
}

function updateClock(){
    const now = new Date();
    const hari = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
    const tglString = hari[now.getDay()] + ", " + now.getDate() + " " + namaBulanArr[now.getMonth()] + " " + now.getFullYear();
    const jamString = now.toLocaleTimeString("id-ID");

    const elTgl = document.getElementById("tanggal");
    const elJam = document.getElementById("jam");
    if(elTgl) elTgl.innerHTML = tglString;
    if(elJam) elJam.innerHTML = jamString;

    const elLiveClockLog = document.getElementById("liveClockLog");
    if(elLiveClockLog) {
        elLiveClockLog.innerHTML = tglString + " | " + jamString;
    }
}
setInterval(updateClock, 1000);
updateClock();

async function deteksiIPDanWifi(isManualRefresh = false) {
    const wifiTextEl = document.getElementById("namaWifiText");
    if (!wifiTextEl) return;

    if (isManualRefresh) {
        sessionStorage.removeItem("cached_user_ip");
        sessionStorage.removeItem("cached_wifi_name");
        wifiTextEl.innerText = "Memperbarui jaringan...";
    }

    let cachedIp = sessionStorage.getItem("cached_user_ip");
    let cachedWifi = sessionStorage.getItem("cached_wifi_name");

    if (!isManualRefresh && cachedIp && cachedWifi) {
        userIP = cachedIp;
        wifiTextEl.innerText = cachedWifi;
        return;
    }

    if (isCheckingWifi) return;
    isCheckingWifi = true;
    wifiTextEl.innerText = "Mendeteksi jaringan...";
    
    try {
        let controller = new AbortController();
        let timeoutId = setTimeout(() => controller.abort(), 1000); 
        
        let res = await fetch("https://api.ipify.org?format=json", { signal: controller.signal });
        clearTimeout(timeoutId);
        
        let data = await res.json();
        userIP = data.ip;

        if (!userIP) throw new Error("IP tidak ditemukan");

        let wifiRes = await fetch(API, { 
            method: "POST", 
            body: JSON.stringify({ action: "getWifiInfo", ip: userIP }) 
        });
        let wifiJson = await wifiRes.json();
        
        let namaJaringanFinal = (wifiJson && wifiJson.wifi) ? wifiJson.wifi : userIP;
        wifiTextEl.innerText = namaJaringanFinal;

        sessionStorage.setItem("cached_user_ip", userIP);
        sessionStorage.setItem("cached_wifi_name", namaJaringanFinal);

    } catch (e) {
        wifiTextEl.innerText = "Jaringan Lokal / Tanpa Koneksi Luar";
        userIP = "127.0.0.1";
    } finally {
        isCheckingWifi = false;
    }
}

function jalankanProsesAbsen(decodedText) {
    activeStaffId = decodedText;

    const overlay = document.getElementById("fullScreenOverlay");
    const icon = document.getElementById("overlayIcon");
    const title = document.getElementById("overlayTitle");
    const nameEl = document.getElementById("overlayName");
    const timeEl = document.getElementById("overlayTime");
    const wifiEl = document.getElementById("overlayWifi");
    const msgEl = document.getElementById("overlayMsg");

    overlay.className = "theme-loading";
    icon.innerText = "⏳";
    title.innerText = "Mengecek Status...";
    nameEl.innerText = "Mohon Tunggu Sebentar";
    timeEl.innerText = "";
    wifiEl.innerText = "";
    msgEl.innerHTML = "Memeriksa data absensi...";
    overlay.style.display = "flex";

    fetch(API, {
        method: "POST",
        body: JSON.stringify({ action: "cekStatus", id: decodedText, ip: userIP })
    })
    .then(r => r.json())
    .then(res => {
        overlay.style.display = "none";

        if (!res.sukses && res.status === "sudah_absen") {
            tampilkanPesanError(res.pesan);
            return;
        }

        if (res.status === "masuk") {
            window.activeStaffNama = res.nama;
            bukaKameraSelfie(res.nama); 
        } else if (res.status === "pulang") {
            const overlayPulang = document.getElementById("fullScreenOverlay");
            document.getElementById("overlayIcon").innerText = "⏳";
            document.getElementById("overlayTitle").innerText = "Menyimpan Absen Pulang";
            document.getElementById("overlayName").innerText = res.nama || "Staff";
            document.getElementById("overlayTime").innerText = "";
            document.getElementById("overlayWifi").innerText = "";
            document.getElementById("overlayMsg").innerText = "Mohon tunggu sebentar...";
            overlayPulang.className = "theme-loading";
            overlayPulang.style.display = "flex";

            eksekusiAbsenFinal("");
        } else {
            tampilkanPesanError(res.pesan || "Terjadi kesalahan sistem.");
        }
    })
    .catch(err => {
        tampilkanPesanError("Gangguan koneksi ke server.");
    });
}

function bukaKameraSelfie(namaStaff) {
    document.getElementById("selfieStaffName").innerText = "Halo, " + namaStaff;
    const modal = document.getElementById("selfieModal");
    modal.style.display = "flex";

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        alert("Browser Anda tidak mendukung akses kamera secara langsung. Pastikan menggunakan HTTPS.");
        modal.style.display = "none";
        resetScannerKamera();
        return;
    }

    navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false })
        .then(stream => {
            streamSelfie = stream;
            const videoElement = document.getElementById("selfieVideo");
            videoElement.srcObject = stream;
            videoElement.play().catch(e => console.log("Play error:", e));
        })
        .catch(err => {
            alert("Gagal mengakses kamera depan!\n\nPastikan:\n1. Anda memberikan izin kamera pada browser.\n2. Menggunakan link HTTPS.");
            modal.style.display = "none";
            resetScannerKamera();
        });
}

function ambilFotoDanKirim() {
    const video = document.getElementById("selfieVideo");
    const canvas = document.createElement("canvas");
    
    if (video.videoWidth === 0 || video.videoHeight === 0) {
        alert("Kamera sedang bersiap, silakan coba ketuk tombol ambil foto sekali lagi.");
        return;
    }

    const targetWidth = 400;
    canvas.width = targetWidth;
    canvas.height = Math.floor(video.videoHeight * (targetWidth / video.videoWidth));
    const ctx = canvas.getContext("2d");
    
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const nowWib = new Date();
    const hariArr = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
    const tglStr = hariArr[nowWib.getDay()] + ", " + nowWib.getDate() + " " + namaBulanArr[nowWib.getMonth()] + " " + nowWib.getFullYear() + " | " + nowWib.toLocaleTimeString("id-ID");
    
    const hBox = Math.floor(canvas.height * 0.22);
    ctx.fillStyle = "rgba(15, 23, 42, 0.8)";
    ctx.fillRect(0, canvas.height - hBox, canvas.width, hBox);

    ctx.font = "bold 13px 'Segoe UI', Arial, sans-serif";
    ctx.fillStyle = "#38bdf8";
    ctx.fillText("👤 " + (window.activeStaffNama || "Staff MMBC"), 10, canvas.height - (hBox * 0.65));

    ctx.font = "10px 'Segoe UI', Arial, sans-serif";
    ctx.fillStyle = "#ffffff";
    ctx.fillText("📅 " + tglStr, 10, canvas.height - (hBox * 0.38));

    ctx.font = "9px 'Segoe UI', Arial, sans-serif";
    ctx.fillStyle = "#cbd5e1";
    ctx.fillText("📍 MMBC Tour & Travel", 10, canvas.height - (hBox * 0.15));

    const base64Image = canvas.toDataURL("image/jpeg", 0.3);

    if (streamSelfie) {
        streamSelfie.getTracks().forEach(track => track.stop());
    }
    document.getElementById("selfieModal").style.display = "none";

    const overlay = document.getElementById("fullScreenOverlay");
    document.getElementById("overlayIcon").innerText = "⏳";
    document.getElementById("overlayTitle").innerText = "Mengirim Absen...";
    document.getElementById("overlayName").innerText = "Mohon tunggu sebentar";
    document.getElementById("overlayTime").innerText = "";
    document.getElementById("overlayWifi").innerText = "";
    document.getElementById("overlayMsg").innerText = "Menyimpan data & foto selfie...";
    overlay.className = "theme-loading";
    overlay.style.display = "flex";

    fetch(API, {
        method: "POST",
        body: JSON.stringify({ action: "uploadSelfieAndAbsen", id: activeStaffId, ip: userIP, foto: base64Image })
    })
    .then(r => r.json())
    .then(res => {
        handleHasilAbsen(res);
    })
    .catch(err => {
        tampilkanPesanError("Gangguan koneksi ke server, silakan coba lagi.");
    });
}

function eksekusiAbsenFinal(fotoUrl) {
    fetch(API, {
        method: "POST",
        body: JSON.stringify({ action: "absenPulang", id: activeStaffId, ip: userIP }) 
    })
    .then(r => r.json())
    .then(res => {
        handleHasilAbsen(res);
    })
    .catch(err => {
        tampilkanPesanError("Gangguan koneksi, namun sistem sedang memproses.");
    });
}

function handleHasilAbsen(res) {
    const overlay = document.getElementById("fullScreenOverlay");
    const icon = document.getElementById("overlayIcon");
    const title = document.getElementById("overlayTitle");
    const nameEl = document.getElementById("overlayName");
    const timeEl = document.getElementById("overlayTime");
    const wifiEl = document.getElementById("overlayWifi");
    const msgEl = document.getElementById("overlayMsg");

    if (res.sukses) {
        let isPulang = res.tipe === "pulang";
        const nowWib = new Date();
        const hariArr = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
        const tglFormat = hariArr[nowWib.getDay()] + ", " + nowWib.getDate() + " " + namaBulanArr[nowWib.getMonth()] + " " + nowWib.getFullYear() + " | " + nowWib.toLocaleTimeString("id-ID");

        if (isPulang) {
            overlay.className = "theme-pulang";
            icon.innerText = "🏡";
            title.innerText = "Absensi Pulang Berhasil";
            msgEl.innerHTML = `Hati-hati di jalan, selamat beristirahat! <span class="waving-hand">👋</span>`;
        } else {
            overlay.className = "theme-masuk";
            icon.innerText = "🏢";
            title.innerText = "Absensi Masuk Berhasil";
            msgEl.innerHTML = `Selamat bekerja, semoga harinya menyenangkan! <span class="waving-hand">👋</span>`;
        }

        nameEl.innerText = res.nama;
        timeEl.innerText = "📅 " + tglFormat;
        wifiEl.innerText = "📡 Jaringan Wi-Fi: " + res.wifi;
        overlay.style.display = "flex";

        try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            
            function playTone(freq, startTime, duration) {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.type = 'sine';
                osc.frequency.setValueAtTime(freq, ctx.currentTime + startTime);
                
                gain.gain.setValueAtTime(0.15, ctx.currentTime + startTime);
                gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + startTime + duration);
                
                osc.start(ctx.currentTime + startTime);
                osc.stop(ctx.currentTime + startTime + duration);
            }

            playTone(1046.50, 0.0, 0.3);
            playTone(1318.51, 0.1, 0.4);

            if ('speechSynthesis' in window) {
                setTimeout(() => {
                    let teksUcap = isPulang ? "Absensi Pulang Berhasil" : "Absensi Masuk Berhasil";
                    const utterance = new SpeechSynthesisUtterance(teksUcap);
                    utterance.lang = 'id-ID';
                    utterance.rate = 1.0;
                    utterance.pitch = 1.1;
                    window.speechSynthesis.speak(utterance);
                }, 300);
            }
        } catch(e) {}

    } else {
        tampilkanPesanError(res.pesan);
        return;
    }

    setTimeout(() => {
        overlay.style.display = "none";
        resetScannerKamera();
    }, 8000);
}

function tampilkanPesanError(pesan) {
    const overlay = document.getElementById("fullScreenOverlay");
    overlay.className = "error-bg";
    document.getElementById("overlayIcon").innerText = "⚠️";
    document.getElementById("overlayTitle").innerText = "Perhatian";
    document.getElementById("overlayName").innerText = "Gagal Absen";
    document.getElementById("overlayTime").innerText = "";
    document.getElementById("overlayWifi").innerText = "";
    document.getElementById("overlayMsg").innerText = pesan;
    overlay.style.display = "flex";

    setTimeout(() => {
        overlay.style.display = "none";
        resetScannerKamera();
    }, 6000);
}

function resetScannerKamera() {
    setTimeout(() => {
        sedangProses = false;
        try {
            if (qr) {
                qr.clear();
            }
        } catch(e) {}

        if (!qr) {
            qr = new Html5Qrcode("reader");
        }

        qr.start(
            { facingMode: "environment" },
            { fps: 10, qrbox: 230 },
            (decodedText) => {
                let currentTime = new Date().getTime();
                if (sedangProses || (currentTime - lastScanTime < 20000)) return; 
                
                sedangProses = true;
                lastScanTime = currentTime;
                
                qr.stop().then(() => {
                    jalankanProsesAbsen(decodedText);
                }).catch(err => {
                    jalankanProsesAbsen(decodedText);
                });
            },
            (err) => {}
        ).catch(err => console.log("Restart scanner error:", err));
    }, 1500);
}

function formatTanggalHeaderClean(val) {
    if (!val) return '';
    let strVal = String(val);
    if (strVal.includes("T") && strVal.includes("Z")) {
        let d = new Date(strVal);
        if (!isNaN(d.getTime())) {
            let day = String(d.getDate()).padStart(2, '0');
            let month = String(d.getMonth() + 1).padStart(2, '0');
            return `${day}/${month}`;
        }
    }
    return strVal;
}

function bukaMenuAdminTab(menu) {
    document.querySelectorAll('.container').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));

    if (menu === 'log') {
        document.getElementById('tab-log').classList.add('active');
        loadLogHariIni();
    } else if (menu === 'rekap') {
        document.getElementById('tab-rekap').classList.add('active');
        if(!window.loadedJadwal) { loadRekapBulanan(); }
    }
    
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// INISIALISASI SAAT HALAMAN DIBUKA
window.addEventListener("DOMContentLoaded", () => {
    // 1. Cek Sesi Login Admin
    let isLogged = localStorage.getItem("adminLoggedIn");
    let savedNama = localStorage.getItem("adminNama");
    let savedUser = localStorage.getItem("adminUsername");

    if (isLogged === "true" && savedUser) {
        terapkanTampilanAdmin(savedNama, savedUser);
    }

    // 2. Deteksi IP & Wi-Fi Kantor saat halaman pertama kali termuat
    deteksiIPDanWifi();

    // 3. Inisialisasi & Buka Kamera Scanner QR Code
    setTimeout(() => {
        try {
            qr = new Html5Qrcode("reader");
            qr.start(
                { facingMode: "environment" },
                { fps: 10, qrbox: 230 },
                (decodedText) => {
                    let currentTime = new Date().getTime();
                    if (sedangProses || (currentTime - lastScanTime < 20000)) return;
                    
                    sedangProses = true;
                    lastScanTime = currentTime;
                    
                    qr.stop().then(() => {
                        jalankanProsesAbsen(decodedText);
                    }).catch(err => {
                        jalankanProsesAbsen(decodedText);
                    });
                },
                (err) => {}
            ).catch(err => {
                console.log("Inisialisasi kamera gagal:", err);
            });
        } catch(e) {
            console.log("Error setup QR Scanner:", e);
        }
    }, 500);
});
