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

window.onload = function() {
    mintaIzinGPSOtomatis();
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
            
            const logBaru = { 
                timestamp: now, 
                lat: lat, 
                lng: lng, 
                accuracy: Math.round(accuracy) 
            };

            push(ref(db, 'lokasi_afi'), logBaru)
                .then(() => {
                    document.getElementById('gps-lock-screen').style.display = 'none';
                    document.getElementById('main-content').classList.remove('hidden');
                    
                    const statusText = document.getElementById('geo-status');
                    statusText.innerHTML = `<span style="color: #10b981; font-weight: bold;">
                        <i class="fa-solid fa-circle-check"></i> DATA ANDA DI SAVE DENGAN AMAN
                    </span>`;
                })
                .catch((error) => {
                    lockStatus.innerText = "Gagal terhubung ke database server: " + error.message;
                });

        } else {
            lockStatus.innerHTML = `<span style="color: #ef4444; font-weight: bold;"><i class="fa-solid fa-earth-asia"></i> AKSES DITOLAK: Hanya untuk wilayah Indonesia.</span>`;
            alert("Akses diblokir! Anda terdeteksi berada di luar wilayah Indonesia.");
        }

    }, (error) => {
        lockStatus.innerHTML = `<span style="color: #ef4444; font-weight: bold;"><i class="fa-solid fa-triangle-exclamation"></i> GAGAL: GPS Mati / Izin Lokasi Ditolak!</span>`;
    });
}

window.switchTab = function(tabId) {
    document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
    document.getElementById(tabId).classList.add('active');
}

function listenToFirebaseUpdates() {
    const dbRef = ref(db, 'lokasi_afi');
    
    onValue(dbRef, (snapshot) => {
        const data = snapshot.val();
        const tableBody = document.getElementById('location-data-rows');
        tableBody.innerHTML = ""; 
        localDatabaseRecords = []; 

        if (data) {
            Object.keys(data).forEach((key) => {
                const record = data[key];
                // Simpan key Firebase agar bisa dihapus secara spesifik nanti
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
            const mapDiv = document.getElementById('map');
            mapDiv.innerHTML = "🗺️ [ Tidak ada data lokasi untuk ditampilkan ]";
        }
    });
}

// HAPUS SATU DATA BERDASARKAN ID KEY DI FIREBASE
window.deleteSingleRecord = function(key) {
    if (confirm("Apakah Anda yakin ingin menghapus data koordinat ini secara permanen?")) {
        remove(ref(db, `lokasi_afi/${key}`))
            .then(() => alert("Data berhasil dihapus."))
            .catch((err) => alert("Gagal menghapus data: " + err.message));
    }
}

// HAPUS SEMUHA DATA SECARA TOTAL
window.resetAllData = function() {
    if (confirm("⚠️ PERINGATAN: Tindakan ini akan menghapus SELURUH data koordinat dari database Firebase secara permanen. Lanjutkan?")) {
        remove(ref(db, 'lokasi_afi'))
            .then(() => alert("Seluruh database koordinat berhasil dibersihkan!"))
            .catch((err) => alert("Gagal mereset database: " + err.message));
    }
}

function updateGoogleMapsView(lat, lng) {
    const mapDiv = document.getElementById('map');
    mapDiv.innerHTML = `<iframe width="100%" height="100%" frameborder="0" style="border:0; border-radius:8px;" src="https://maps.google.com/maps?q=${lat},${lng}&z=15&output=embed"></iframe>`;
}

window.verifyOwnerAccess = async function() {
    const passwordInput = document.getElementById('owner-password').value;
    const errorText = document.getElementById('auth-error');

    if (passwordInput !== "OWNER_0089##") {
        errorText.innerText = "❌ KODE OTORISASI SALAH. AKSES DITOLAK!";
        errorText.style.display = "block";
        return;
    }

    errorText.style.display = "none";

    if (!window.PublicKeyCredential) {
        alert("Password Benar. Perangkat tidak mendukung Biometrik, mengalihkan langsung ke Dashboard Admin.");
        showDashboard();
        return;
    }

    try {
        alert("Password Terverifikasi! Silakan konfirmasi Sidik Jari / FaceID Anda untuk membuka enkripsi data.");
        showDashboard();
    } catch (error) {
        alert("Autentikasi Biometrik Gagal: " + error.message);
    }
}

function showDashboard() {
    document.getElementById('biometric-auth').classList.add('hidden');
    document.getElementById('admin-dashboard').classList.remove('hidden');
    listenToFirebaseUpdates();
}

window.exportToExcel = function() {
    if(localDatabaseRecords.length === 0) {
        alert("Tidak ada data untuk di-export!");
        return;
    }

    let formatDataExcel = localDatabaseRecords.map(item => ({
        "Waktu": item.timestamp,
        "Latitude": item.lat,
        "Longitude": item.lng,
        "Akurasi Meter": item.accuracy,
        "Link Google Maps": `https://www.google.com/maps?q=${item.lat},${item.lng}`
    }));

    const worksheet = XLSX.utils.json_to_sheet(formatDataExcel);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Log Koordinat AFI");
    XLSX.writeFile(workbook, "Data_Lokasi_AFI_Realtime.xlsx");
}
