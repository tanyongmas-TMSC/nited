const app = {
    
    init: function() {
        this.loadDashboardData();
    },

    showPage: function(pageId) {
        // อัปเดตเมนู
        document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
        event.currentTarget.classList.add('active');

        // สลับหน้าจอ
        document.querySelectorAll('.page').forEach(el => el.classList.remove('active'));
        document.getElementById(pageId).classList.add('active');

        // โหลดข้อมูลตามหน้า
        if(pageId === 'dashboard') {
            this.loadDashboardData();
        }
    },

    showLoader: function(text = 'กำลังดำเนินการ...') {
        document.getElementById('loaderText').innerText = text;
        document.getElementById('loader').style.display = 'flex';
    },

    hideLoader: function() {
        document.getElementById('loader').style.display = 'none';
    },

    // -----------------------------------------
    // API CALLS
    // -----------------------------------------

    loadDashboardData: function() {
        this.showLoader('กำลังโหลดข้อมูลสถิติ...');
        
        fetch(CONFIG.GAS_URL + "?action=getStats")
            .then(res => res.json())
            .then(res => {
                if(res.status === 'success') {
                    document.getElementById('statTotalBookings').innerText = res.data.totalBookings;
                    document.getElementById('statSupervised').innerText = res.data.supervisedCount;
                    document.getElementById('statPendingFiles').innerText = res.data.pendingFiles;
                }
                return fetch(CONFIG.GAS_URL + "?action=getBookings");
            })
            .then(res => res.json())
            .then(res => {
                this.hideLoader();
                if(res.status === 'success') {
                    this.renderRecentBookings(res.data);
                }
            })
            .catch(err => {
                this.hideLoader();
                console.error(err);
            });
    },

    renderRecentBookings: function(bookings) {
        const tbody = document.querySelector('#recentBookingsTable tbody');
        tbody.innerHTML = '';
        
        // เอา 5 รายการล่าสุด
        const recent = bookings.slice(-5).reverse();
        
        if(recent.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">ยังไม่มีข้อมูลการจอง</td></tr>';
            return;
        }

        recent.forEach(b => {
            let badgeClass = 'badge-pending';
            if(b.Status === 'ยืนยันแล้ว' || b.Status === 'นิเทศแล้ว') badgeClass = 'badge-success';
            if(b.Status === 'ปฏิเสธ') badgeClass = 'badge-danger';
            
            let dateStr = new Date(b.Date).toLocaleDateString('th-TH');

            let tr = `<tr>
                <td>${dateStr}</td>
                <td>${b.Period}</td>
                <td>${b['Teacher Name']}</td>
                <td>${b.Department}</td>
                <td>${b['Subject Name']}</td>
                <td><span class="badge ${badgeClass}">${b.Status}</span></td>
            </tr>`;
            tbody.innerHTML += tr;
        });
    },

    submitBooking: function(e) {
        e.preventDefault();
        this.showLoader('กำลังบันทึกข้อมูลการจอง...');
        
        const form = e.target;
        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());
        data.action = 'createBooking';
        // Format time is missing in form, just mock it or add field later. 
        data.time = data.period; 

        fetch(CONFIG.GAS_URL, {
            method: 'POST',
            body: JSON.stringify(data)
        })
        .then(res => res.json())
        .then(res => {
            this.hideLoader();
            if(res.status === 'success') {
                alert('บันทึกการจองสำเร็จ!');
                form.reset();
                this.showPage('dashboard');
                // trigger nav update visually
                document.querySelectorAll('.nav-item')[0].click();
            } else {
                alert('เกิดข้อผิดพลาด: ' + res.message);
            }
        })
        .catch(err => {
            this.hideLoader();
            alert('ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้');
        });
    },

    toggleUploadInput: function() {
        const type = document.getElementById('fileTypeSelect').value;
        if(type === 'คลิปวิดีโอ') {
            document.getElementById('fileInputContainer').style.display = 'none';
            document.getElementById('linkInputContainer').style.display = 'block';
        } else {
            document.getElementById('fileInputContainer').style.display = 'block';
            document.getElementById('linkInputContainer').style.display = 'none';
        }
    },

    submitUpload: function(e) {
        e.preventDefault();
        
        const form = e.target;
        const fileType = document.getElementById('fileTypeSelect').value;
        const teacherName = form.upTeacherName.value;
        
        if(!fileType) { alert("กรุณาเลือกประเภทไฟล์"); return; }
        
        this.showLoader('กำลังอัปโหลดไฟล์ (อาจใช้เวลาสักครู่)...');

        let payload = {
            action: 'uploadFile',
            teacherName: teacherName,
            fileType: fileType
        };

        if(fileType === 'คลิปวิดีโอ') {
            payload.fileLink = document.getElementById('linkInput').value;
            this.sendUploadRequest(payload, form);
        } else {
            const file = document.getElementById('fileInput').files[0];
            if(!file) {
                this.hideLoader();
                alert("กรุณาเลือกไฟล์");
                return;
            }
            if(file.size > 10 * 1024 * 1024) {
                this.hideLoader();
                alert("ไฟล์มีขนาดเกิน 10MB");
                return;
            }

            const reader = new FileReader();
            reader.onload = function(e) {
                payload.fileName = file.name;
                payload.fileData = e.target.result;
                app.sendUploadRequest(payload, form);
            };
            reader.readAsDataURL(file);
        }
    },

    sendUploadRequest: function(payload, form) {
        fetch(CONFIG.GAS_URL, {
            method: 'POST',
            body: JSON.stringify(payload)
        })
        .then(res => res.json())
        .then(res => {
            this.hideLoader();
            if(res.status === 'success') {
                alert('ส่งผลงานสำเร็จ!');
                form.reset();
            } else {
                alert('เกิดข้อผิดพลาด: ' + res.message);
            }
        })
        .catch(err => {
            this.hideLoader();
            alert('ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้');
        });
    },

    loginAdmin: function() {
        const pass = document.getElementById('adminPass').value;
        if(pass === 'admin1234') {
            document.getElementById('adminLogin').style.display = 'none';
            document.getElementById('adminPanel').style.display = 'block';
            this.loadAdminBookings();
        } else {
            alert('รหัสผ่านไม่ถูกต้อง');
        }
    },

    submitEvaluation: function(e) {
        e.preventDefault();
        this.showLoader('กำลังบันทึกผลการประเมิน...');
        
        const form = e.target;
        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());
        data.action = 'submitEvaluation';

        fetch(CONFIG.GAS_URL, {
            method: 'POST',
            body: JSON.stringify(data)
        })
        .then(res => res.json())
        .then(res => {
            this.hideLoader();
            if(res.status === 'success') {
                alert('บันทึกผลการประเมินสำเร็จ!');
                form.reset();
            } else {
                alert('เกิดข้อผิดพลาด: ' + res.message);
            }
        })
        .catch(err => { this.hideLoader(); alert('เกิดข้อผิดพลาดในการเชื่อมต่อ'); });
    },

    loadAdminBookings: function() {
        document.getElementById('adminBookingsSection').style.display = 'block';
        document.getElementById('adminFilesSection').style.display = 'none';
        this.showLoader('กำลังโหลดคำขอจอง...');

        fetch(CONFIG.GAS_URL + "?action=getBookings")
            .then(res => res.json())
            .then(res => {
                this.hideLoader();
                if(res.status === 'success') this.renderAdminBookings(res.data);
            })
            .catch(err => { this.hideLoader(); alert('โหลดข้อมูลล้มเหลว'); });
    },

    renderAdminBookings: function(bookings) {
        const tbody = document.querySelector('#adminBookingsTable tbody');
        tbody.innerHTML = '';
        if(bookings.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">ไม่มีข้อมูล</td></tr>';
            return;
        }

        bookings.reverse().forEach(b => {
            let badgeClass = 'badge-pending';
            if(b.Status === 'ยืนยันแล้ว' || b.Status === 'นิเทศแล้ว') badgeClass = 'badge-success';
            if(b.Status === 'ปฏิเสธ') badgeClass = 'badge-danger';
            
            let dateStr = new Date(b.Date).toLocaleDateString('th-TH');
            
            let btnConfirm = `<button class="btn btn-success" style="padding:5px 10px; font-size:12px;" onclick="app.updateBookingStatus(${b.rowIndex}, 'ยืนยันแล้ว')">ยืนยัน</button>`;
            let btnReject = `<button class="btn btn-danger" style="padding:5px 10px; font-size:12px; background:#dc3545;" onclick="app.updateBookingStatus(${b.rowIndex}, 'ปฏิเสธ')">ปฏิเสธ</button>`;
            let btnDone = `<button class="btn btn-primary" style="padding:5px 10px; font-size:12px;" onclick="app.updateBookingStatus(${b.rowIndex}, 'นิเทศแล้ว')">นิเทศแล้ว</button>`;

            let tr = `<tr>
                <td>${dateStr}</td>
                <td>${b.Period}</td>
                <td>${b['Teacher Name']}</td>
                <td>${b['Subject Name']}</td>
                <td><span class="badge ${badgeClass}">${b.Status}</span></td>
                <td>${btnConfirm} ${btnReject} ${btnDone}</td>
            </tr>`;
            tbody.innerHTML += tr;
        });
    },

    updateBookingStatus: function(rowIndex, status) {
        if(!confirm(`ยืนยันการเปลี่ยนสถานะเป็น "${status}" ?`)) return;
        this.showLoader('กำลังอัปเดตสถานะ...');
        
        fetch(CONFIG.GAS_URL, {
            method: 'POST',
            body: JSON.stringify({ action: 'updateBookingStatus', rowIndex: rowIndex, status: status })
        })
        .then(res => res.json())
        .then(res => {
            if(res.status === 'success') this.loadAdminBookings();
            else { this.hideLoader(); alert('เกิดข้อผิดพลาด'); }
        });
    },

    loadAdminFiles: function() {
        document.getElementById('adminBookingsSection').style.display = 'none';
        document.getElementById('adminFilesSection').style.display = 'block';
        this.showLoader('กำลังโหลดข้อมูลไฟล์งาน...');

        fetch(CONFIG.GAS_URL + "?action=getFiles")
            .then(res => res.json())
            .then(res => {
                this.hideLoader();
                if(res.status === 'success') this.renderAdminFiles(res.data);
            })
            .catch(err => { this.hideLoader(); alert('โหลดข้อมูลล้มเหลว'); });
    },

    renderAdminFiles: function(files) {
        const tbody = document.querySelector('#adminFilesTable tbody');
        tbody.innerHTML = '';
        if(files.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">ไม่มีข้อมูลไฟล์ส่ง</td></tr>';
            return;
        }

        files.reverse().forEach(f => {
            let badgeClass = 'badge-pending';
            if(f.Status === 'ผ่าน') badgeClass = 'badge-success';
            if(f.Status === 'ขอแก้ไข') badgeClass = 'badge-danger';
            
            let dateStr = new Date(f.Timestamp).toLocaleDateString('th-TH');
            let fileLink = f['Drive File ID'] === 'LINK_ONLY' 
                ? `<a href="${f['File URL/Link']}" target="_blank">เปิดลิงก์</a>` 
                : `<a href="${f['File URL/Link']}" target="_blank">ดูไฟล์</a>`;

            let btnApprove = `<button class="btn btn-success" style="padding:5px 10px; font-size:12px;" onclick="app.updateFileStatus(${f.rowIndex}, 'ผ่าน')">ผ่าน</button>`;
            let btnReject = `<button class="btn btn-danger" style="padding:5px 10px; font-size:12px; background:#dc3545;" onclick="app.updateFileStatus(${f.rowIndex}, 'ขอแก้ไข')">ขอแก้ไข</button>`;

            let tr = `<tr>
                <td>${dateStr}</td>
                <td>${f['Teacher Name']}</td>
                <td>${f['File Type']}</td>
                <td>${fileLink}</td>
                <td><span class="badge ${badgeClass}">${f.Status}</span></td>
                <td>${btnApprove} ${btnReject}</td>
            </tr>`;
            tbody.innerHTML += tr;
        });
    },

    updateFileStatus: function(rowIndex, status) {
        if(!confirm(`ยืนยันการเปลี่ยนสถานะเป็น "${status}" ?`)) return;
        this.showLoader('กำลังอัปเดตสถานะ...');
        
        fetch(CONFIG.GAS_URL, {
            method: 'POST',
            body: JSON.stringify({ action: 'updateFileStatus', rowIndex: rowIndex, status: status })
        })
        .then(res => res.json())
        .then(res => {
            if(res.status === 'success') this.loadAdminFiles();
            else { this.hideLoader(); alert('เกิดข้อผิดพลาด'); }
        });
    }
};

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    app.init();
});
