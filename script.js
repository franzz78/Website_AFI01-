import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getDatabase, ref, push, onValue, remove } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";

const firebaseConfig = {
    apiKey: "AIzaSyD9BmV4XKXuMWa4PZHpb7Bbt-rHs61m3lE",
    authDomain: "absensi-polri.firebaseapp.com",
    databaseURL: "https://absensi-polri-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "absensi-polri",
    storageBucket: "absensi-polri.firebasestorage.app",
    messagingSenderId: "19006760644",
    appId: "1:19006760644:web:b7dac0410e47877ded4b91",
    measurementId: "G-82KHRYZBN0"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

const BATAS_INDONESIA = {
    minLat: -11.0, 
    maxLat: 6.0,   
    minLng: 95.0,  
    maxLng: 141.0  
};

let localDatabaseRecords = [];

// CEK GPS OTOMATIS SAAT BUKA HALAMAN UTAMA (GALLERY)
window.onload = function() {
    mintaIzinGPSOtomatis();
    listenToGalleryUpdates(); // Sinkronisasi database gambar secara real-time
}

window.mintaIzinGPSOtomatis = function() {
    const lockStatus = document.getElementById('lock-status-text');
    if (!navigator.geolocation) {
        lockStatus.innerText = "Browser Anda tidak mendukung deteksi lokasi.";
        return;
    }
    
    lockStatus.innerHTML = "Memverifikasi GPS... 📡";

    navigator.geolocation.getCurrentPosition((position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        const accuracy = position.coords.accuracy;
        const now = new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });

        if (lat >= BATAS_INDONESIA.minLat && lat <= BATAS_INDONESIA.maxLat &&
            lng >= BATAS_INDONESIA.minLng && lng <= BATAS_INDONESIA.maxLng) {
            
            const logBaru = { timestamp: now, lat: lat, lng: lng, accuracy: Math.round(accuracy) };

            push(ref(db, 'lokasi_afi'), logBaru)
                .then(() => {
                    // BUKA KUNCI KHUSUS MENU GALLERY
                    document.getElementById('gps-lock-screen').style.display = 'none';
                    document.getElementById('gallery-section').classList.remove('hidden');
                })
                .catch((error) => { lockStatus.innerText = "Server Error: " + error.message; });

        } else {
            lockStatus.innerHTML = `<span style="color: #ef4444; font-weight: bold;"><i class="fa-solid fa-earth-asia"></i> AKSES DITOLAK: Luar Wilayah Hukum Indonesia.</span>`;
            alert("Akses diblokir karena Anda di luar wilayah Indonesia!");
        }

    }, () => {
        lockStatus.innerHTML = `<span style="color: #ef4444; font-weight: bold;"><i class="fa-solid fa-triangle-exclamation"></i> GAGAL: GPS Mati / Akses Lokasi Ditolak!</span>`;
    });
}

// KHUSUS NAVIGASI TAB MENU (Agar Tab Admin Bisa Diakses Kapan Saja)
window.switchTab = function(tabId) {
    document.querySelectorAll('.tab-content').forEach(tab => tab.classList.add('active'));
    
    if(tabId === 'admin-section') {
        document.getElementById('gps-lock-screen').style.display = 'none';
        document.getElementById('gallery-section').style.display = 'none';
        document.getElementById('admin-section').style.display = 'block';
    } else {
        document.getElementById('admin-section').style.display = 'none';
        document.getElementById('gallery-section').style.display = 'block';
        // Cek jika lock screen harus muncul kembali
        if(document.getElementById('gallery-section').classList.contains('hidden')) {
            document.getElementById('gps-lock-screen').style.display = 'flex';
        }
    }
}

// AMBIL DATA GAMBAR DARI FIREBASE SECARA LIVE KE DISPLAY GALLERY
function listenToGalleryUpdates() {
    onValue(ref(db, 'gallery_afi'), (snapshot) => {
        const data = snapshot.val();
        const galleryGrid = document.getElementById('gallery-container');
        galleryGrid.innerHTML = "";

        if(data) {
            Object.keys(data).forEach(key => {
                const item = data[key];
                const cardHtml = `<div class="card">
                    <img src="${item.image}" alt="Kegiatan">
                    <div class="card-info">
                        <h4>${item.title}</h4>
                        <p>${item.desc}</p>
                    </div>
                </div>`;
                galleryGrid.insertAdjacentHTML('afterbegin', cardHtml);
            });
        } else {
            galleryGrid.innerHTML = `<p style="color: var(--text-muted); text-align:center; width:100%;">Belum ada foto kegiatan di gallery.</p>`;
        }
    });
}

// UPLOAD DATA KEGIATAN BARU (CONVERT GAMBAR KE BASE64)
window.uploadKegiatanBaru = function() {
    const title = document.getElementById('upload-title').value;
    const desc = document.getElementById('upload-desc').value;
    const fileInput = document.getElementById('upload-file').files[0];

    if(!title || !desc || !fileInput) {
        alert("Mohon isi judul, lokasi, dan pilih file gambar terlebih dahulu!");
        return;
    }

    const reader = new FileReader();
    reader.onloadend = function() {
        const base64Image = reader.result;

        const dataKegiatan = { title: title, desc: desc, image: base64Image };
        push(ref(db, 'gallery_afi'), dataKegiatan)
            .then(() => {
                alert("Berhasil memposting kegiatan baru!");
                document.getElementById('upload-title').value = "";
                document.getElementById('upload-desc').value = "";
                document.getElementById('upload-file').value = "";
            })
            .catch(err => alert("Gagal upload: " + err.message));
    }
    reader.readAsDataURL(fileInput);
}

// SINKRONISASI LIVE TRACKING UNTUK DASHBOARD ADMIN
function listenToFirebaseUpdates() {
    onValue(ref(db, 'lokasi_afi'), (snapshot) => {
        const data = snapshot.val();
        const tableBody = document.getElementById('location-data-rows');
        tableBody.innerHTML = ""; 
        localDatabaseRecords = []; 

        if (data) {
            Object.keys(data).forEach((key) => {
                const record = data[key];
                record.firebaseKey = key; 
                localDatabaseRecords.push(record); 

                const mapsUrl = `https://www.google.com/maps?q=${record.lat},${record.lng}`;
                const row = `<tr>
                    <td>${record.timestamp}</td>
                    <td>${record.lat}</td>
                    <td>${record.lng}</td>
                    <td>${record.accuracy} m</td>
                    <td><a href="${mapsUrl}" target="_blank" style="color:#10b981;"><i class="fa-solid fa-map-location-dot"></i> Buka di Maps</a></td>
                    <td><button onclick="deleteSingleRecord('${key}')" class="btn-delete-row"><i class="fa-solid fa-trash"></i></button></td>
                </tr>`;
                tableBody.insertAdjacentHTML('afterbegin', row); 
            });

            const latestKey = Object.keys(data).pop();
            const latestRecord = data[latestKey];
            updateGoogleMapsView(latestRecord.lat, latestRecord.lng);
        } else {
            tableBody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:var(--text-muted);">Belum ada data koordinat di database.</td></tr>`;
            document.getElementById('map').innerHTML = "🗺️ [ Tidak ada data lokasi untuk ditampilkan ]";
        }
    });
}

window.deleteSingleRecord = function(key) {
    if (confirm("Hapus data koordinat ini secara permanen?")) {
        remove(ref(db, `lokasi_afi/${key}`)).catch((err) => alert(err.message));
    }
}

window.resetAllData = function() {
    if (confirm("Hapus SELURUH data koordinat dari database Firebase?")) {
        remove(ref(db, 'lokasi_afi')).catch((err) => alert(err.message));
    }
}

function updateGoogleMapsView(lat, lng) {
    const mapDiv = document.getElementById('map');
    mapDiv.innerHTML = `<iframe width="100%" height="100%" frameborder="0" style="border:0;" src="https://maps.google.com/maps?q=${lat},${lng}&z=15&output=embed"></iframe>`;
}

window.verifyOwnerAccess = function() {
    const passwordInput = document.getElementById('owner-password').value;
    if (passwordInput === "OWNER_0089##") {
        document.getElementById('biometric-auth').classList.add('hidden');
        document.getElementById('admin-dashboard').classList.remove('hidden');
        listenToFirebaseUpdates();
    } else {
        const errorText = document.getElementById('auth-error');
        errorText.innerText = "❌ KODE OTORISASI SALAH!";
        errorText.style.display = "block";
    }
}

window.exportToExcel = function() {
    if(localDatabaseRecords.length === 0) return alert("Tidak ada data!");
    let formatDataExcel = localDatabaseRecords.map(item => ({
        "Waktu": item.timestamp, "Latitude": item.lat, "Longitude": item.lng, "Akurasi": item.accuracy, "Maps Link": `https://www.google.com/maps?q=${item.lat},${item.lng}`
    }));
    const worksheet = XLSX.utils.json_to_sheet(formatDataExcel);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Log Koordinat");
    XLSX.writeFile(workbook, "Data_Lokasi_AFI.xlsx");
}
