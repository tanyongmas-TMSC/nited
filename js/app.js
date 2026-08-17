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
            alert('กำลังพัฒนาระบบหลังบ้านในส่วนต่อไป...');
        } else {
            alert('รหัสผ่านไม่ถูกต้อง');
        }
    }
};

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    app.init();
});
