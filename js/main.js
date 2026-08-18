const app = {
    
    currentUser: null,
    currentRole: null,

    init: function() {
        this.checkAuth();
        this.loadDashboardData();
        this.initEvaluationForm();
    },

    showPage: function(pageId) {
        // อัปเดตเมนู
        document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
        if(event && event.currentTarget.classList.contains('nav-item')) {
            event.currentTarget.classList.add('active');
        }

        // สลับหน้าจอ
        document.querySelectorAll('.page').forEach(el => el.classList.remove('active'));
        const page = document.getElementById(pageId);
        if(page) page.classList.add('active');

        // โหลดข้อมูลตามหน้า
        if(pageId === 'dashboard') {
            this.loadDashboardData();
        } else if(pageId === 'admin') {
            this.loadAdminBookings();
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
    // AUTHENTICATION (MOCK)
    // -----------------------------------------
    checkAuth: function() {
        const storedUser = localStorage.getItem('nited_user');
        const storedRole = localStorage.getItem('nited_role');
        if(storedUser && storedRole) {
            this.setAuthUI(storedUser, storedRole);
        }
    },

    openLoginModal: function() {
        document.getElementById('loginModal').style.display = 'block';
    },

    closeLoginModal: function() {
        document.getElementById('loginModal').style.display = 'none';
    },

    processLogin: function() {
        const user = document.getElementById('loginUsername').value.trim();
        const pass = document.getElementById('loginPassword').value.trim();

        if(!user || !pass) {
            alert('กรุณากรอกชื่อผู้ใช้และรหัสผ่าน');
            return;
        }

        this.showLoader('กำลังตรวจสอบสิทธิ์...');
        fetch(CONFIG.GAS_URL, {
            method: 'POST',
            body: JSON.stringify({ action: 'login', username: user, password: pass })
        })
        .then(res => res.json())
        .then(res => {
            this.hideLoader();
            if(res.status === 'success') {
                this.setAuthUI(res.name || user, res.role);
                localStorage.setItem('nited_user', this.currentUser);
                localStorage.setItem('nited_role', this.currentRole);
                this.closeLoginModal();
                alert('เข้าสู่ระบบสำเร็จ');
            } else {
                alert('ข้อผิดพลาด: ' + res.message);
            }
        })
        .catch(err => {
            this.hideLoader();
            alert('ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้');
        });
    },

    logout: function() {
        localStorage.removeItem('nited_user');
        localStorage.removeItem('nited_role');
        this.currentUser = null;
        this.currentRole = null;

        // Reset UI
        document.querySelectorAll('.auth-only, .admin-only').forEach(el => el.style.display = 'none');
        document.getElementById('btnLoginNav').style.display = 'block';
        document.getElementById('btnLogoutNav').style.display = 'none';
        document.getElementById('userInfoDiv').style.display = 'none';

        this.showPage('dashboard');
    },

    setAuthUI: function(username, role) {
        this.currentUser = username;
        this.currentRole = role;

        // Show/Hide Nav items
        document.querySelectorAll('.auth-only').forEach(el => el.style.display = 'flex');
        
        if(role === 'admin') {
            document.querySelectorAll('.admin-only').forEach(el => el.style.display = 'flex');
        }

        // Pre-fill forms
        const bookingTeacher = document.getElementById('bookingTeacherName');
        const uploadTeacher = document.getElementById('uploadTeacherName');
        if(bookingTeacher && role !== 'admin') bookingTeacher.value = username;
        if(uploadTeacher && role !== 'admin') uploadTeacher.value = username;

        // Update Navbar User Section
        document.getElementById('btnLoginNav').style.display = 'none';
        document.getElementById('btnLogoutNav').style.display = 'block';
        document.getElementById('userInfoDiv').style.display = 'block';
        document.getElementById('userName').innerText = username;
        document.getElementById('userRole').innerText = role === 'admin' ? 'ผู้ดูแลระบบ' : 'ครูผู้สอน';
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
                    
                    document.getElementById('statTotalFiles').innerText = res.data.pendingFiles * 2; 
                    document.getElementById('statEvaluations').innerText = res.data.supervisedCount; 
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

    initEvaluationForm: function() {
        // Render 25-question evaluation form
        this.renderEvaluationForm();

        // Add event listener for calculating score
        document.getElementById('evalForm').addEventListener('change', (e) => {
            if(e.target.name && e.target.name.startsWith('q')) {
                this.calculateEvalScore();
            }
        });
    },

    renderEvaluationForm: function() {
        // 1. กำหนดเทคนิคการสอน
        const teachingTechniques = [
            "กระบวนการสืบค้น", "การเรียนแบบค้นพบ", "การเรียนแบบแก้ปัญหา",
            "การเรียนแบบสร้างแผนผัง", "การตั้งคำถาม", "เทคนิคคู่คิด",
            "การศึกษาเป็นรายบุคคล", "การฝึกปฏิบัติ/ทดลอง", "เกม",
            "การอภิปราย", "กิจกรรมกลุ่ม", "บูรณาการกลุ่มสาระอื่น"
        ];
        const techContainer = document.getElementById('techniquesContainer');
        if(techContainer) {
            techContainer.innerHTML = '';
            teachingTechniques.forEach(tech => {
                techContainer.innerHTML += `
                <label class="flex items-center cursor-pointer hover:bg-blue-100 p-2 rounded-lg transition">
                    <input type="checkbox" name="techniques" value="${tech}" class="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500">
                    <span class="ml-2 text-sm text-slate-700">${tech}</span>
                </label>
                `;
            });
        }

        // 2. กำหนดรายการประเมิน 25 ข้อ จัดกลุ่มตามด้าน
        const criteria = [
            { category: "ด้านการเตรียมการสอน", items: ["1. จัดทำแผนการเรียนรู้ครบองค์ประกอบ", "2. จัดเตรียมวัสดุ-อุปกรณ์ สื่อ นวัตกรรม กิจกรรมตามแผนฯ"] },
            { category: "ด้านการจัดกิจกรรมการเรียนรู้", items: ["3. มีวิธีการนำเข้าสู่บทเรียนที่น่าสนใจ แจ้งวัตถุประสงค์การเรียนรู้", "4. ใช้เทคนิคการสอนที่หลากหลาย เน้นผู้เรียนเป็นสำคัญ", "5. จัดกิจกรรมที่ส่งเสริมให้ค้นคว้าหาคำตอบด้วยตนเอง", "6. จัดกิจกรรมที่ตอบสนองความแตกต่างระหว่างบุคคล", "7. จัดกิจกรรมที่เน้นกระบวนการคิด (วิเคราะห์ สังเคราะห์ สร้างสรรค์)", "8. จัดกิจกรรมให้ผู้เรียนมีส่วนร่วมและแสดงความคิดเห็นเสรี", "9. มีการสอดแทรกคุณธรรม จริยธรรมและคุณลักษณะอันพึงประสงค์", "10. มีการเสริมแรงเมื่อนักเรียนปฏิบัติหรือตอบถูกต้อง", "11. มีการสรุปประเด็น สาระ เนื้อหาในกิจกรรมการเรียนรู้", "12. มอบหมายงานเหมาะสมตามศักยภาพผู้เรียนและเอาใจใส่ดูแล", "13. ใช้เวลาสอนเหมาะสมกับเวลาที่กำหนด"] },
            { category: "ด้านสื่อ นวัตกรรม แหล่งเรียนรู้", items: ["14. ใช้สื่อที่เหมาะสมกับกิจกรรมและศักยภาพของผู้เรียน", "15. ใช้สื่อ แหล่งการเรียนรู้อย่างหลากหลาย"] },
            { category: "ด้านการวัดและประเมินผล", items: ["16. สอดคล้องและครอบคลุมจุดประสงค์", "17. ประเมินผลอย่างหลากหลายและครบทั้ง 3 ด้าน (K.P.A.)"] },
            { category: "ด้านสภาพทั่วไป", items: ["18. การตรงต่อเวลา", "19. การควบคุมความเป็นระเบียบในชั้นเรียน", "20. การจัดบรรยากาศในชั้นเรียน (การจัดห้อง, ความสะอาด)"] },
            { category: "ด้านบุคลิกภาพ", items: ["21. แต่งกายสุภาพ สะอาดเรียบร้อย เหมาะสมกับกาลเทศะ", "22. ใช้ถ้อยคำสุภาพ ถูกต้อง ระดับเสียงดังชัดเจน", "23. ยิ้มแย้มแจ่มใส และควบคุมอารมณ์ในระหว่างสอนได้ดี", "24. เคลื่อนไหวและแสดงท่าทางในการสอนอย่างมีจุดหมาย", "25. แสดงความรัก ความเมตตา กรุณา เอื้ออาทรต่อศิษย์"] }
        ];

        const evalBody = document.getElementById('evaluationBody');
        if(evalBody) {
            evalBody.innerHTML = '';
            let questionIndex = 1;
            criteria.forEach(group => {
                evalBody.innerHTML += `<tr class="bg-slate-100"><td colspan="6" class="p-3 font-bold text-blue-800">${group.category}</td></tr>`;
                group.items.forEach(itemText => {
                    let radioCells = '';
                    for (let score = 0; score <= 4; score++) {
                        radioCells += `<td class="p-2 text-center border-l border-slate-100 hover:bg-blue-50 transition"><input type="radio" name="q${questionIndex}" value="${score}" required class="w-5 h-5 text-blue-600 cursor-pointer"></td>`;
                    }
                    evalBody.innerHTML += `<tr class="hover:bg-slate-50 group"><td class="p-3 text-sm text-slate-700">${itemText}</td>${radioCells}</tr>`;
                    questionIndex++;
                });
            });
        }
    },

    submitEvaluation: function(e) {
        e.preventDefault();
        this.showLoader('กำลังบันทึกผลประเมิน...');
        
        const form = e.target;
        
        // รวบรวมเทคนิคการสอนที่ติ๊กเลือก
        const selectedTechs = Array.from(document.querySelectorAll('input[name="techniques"]:checked')).map(cb => cb.value);
        const otherTech = document.getElementById('otherTechnique') ? document.getElementById('otherTechnique').value : '';
        if (otherTech) selectedTechs.push(otherTech);

        // รวบรวมคะแนน 25 ข้อ
        const scoresArray = [];
        for (let i = 1; i <= 25; i++) {
            const el = document.querySelector(`input[name="q${i}"]:checked`);
            if (el) scoresArray.push(parseInt(el.value));
            else scoresArray.push(0);
        }

        const data = {
            action: 'submitEvaluation',
            supervisionType: form.querySelector('input[name="supervisionType"]:checked') ? form.querySelector('input[name="supervisionType"]:checked').value : '',
            supervisorName: document.getElementById('supervisorName') ? document.getElementById('supervisorName').value : '',
            teacherName: document.getElementById('evalTeacherName') ? document.getElementById('evalTeacherName').value : '',
            subjectGroup: document.getElementById('evalSubjectGroup') ? document.getElementById('evalSubjectGroup').value : '',
            gradeLevel: document.getElementById('evalGradeLevel') ? document.getElementById('evalGradeLevel').value : '',
            period: document.getElementById('evalPeriod') ? document.getElementById('evalPeriod').value : '',
            teachingDate: document.getElementById('evalTeachingDate') ? document.getElementById('evalTeachingDate').value : '',
            topic: document.getElementById('evalTopic') ? document.getElementById('evalTopic').value : '',
            teachingTechniques: selectedTechs.join(', '),
            scores: scoresArray,
            totalScore: document.getElementById('displayScore') ? parseInt(document.getElementById('displayScore').innerText) : 0,
            strengths: document.getElementById('evalStrengths') ? document.getElementById('evalStrengths').value : '',
            improvements: document.getElementById('evalImprovements') ? document.getElementById('evalImprovements').value : '',
            suggestions: document.getElementById('evalSuggestions') ? document.getElementById('evalSuggestions').value : ''
        };

        fetch(CONFIG.GAS_URL, {
            method: 'POST',
            body: JSON.stringify(data)
        })
        .then(res => res.json())
        .then(res => {
            this.hideLoader();
            if(res.status === 'success') {
                alert('บันทึกผลประเมินสำเร็จ!');
                form.reset();
                this.calculateEvalScore(); // Reset score display
            } else {
                alert('เกิดข้อผิดพลาด: ' + res.message);
            }
        })
        .catch(err => { this.hideLoader(); alert('เชื่อมต่อผิดพลาด'); });
    },

    calculateEvalScore: function() {
        let total = 0;
        let answeredCount = 0;
        for (let i = 1; i <= 25; i++) {
            const selected = document.querySelector(`input[name="q${i}"]:checked`);
            if (selected) {
                total += parseInt(selected.value);
                answeredCount++;
            }
        }
        const percent = total; // 25 questions * 4 max = 100 max
        let level = "-";
        if (answeredCount > 0) {
            if (percent < 60) level = "ต้องปรับปรุง";
            else if (percent < 70) level = "ยอมรับได้ (ควรปรับปรุง)";
            else if (percent < 80) level = "ค่อนข้างดี";
            else if (percent < 90) level = "ดี";
            else level = "ดีมาก เป็นตัวอย่างที่ดี";
        }
        const displayScore = document.getElementById('displayScore');
        const displayPercent = document.getElementById('displayPercent');
        const levelEl = document.getElementById('displayLevel');
        
        if(displayScore) displayScore.innerText = total;
        if(displayPercent) displayPercent.innerText = percent.toFixed(1);
        
        if(levelEl) {
            levelEl.innerText = level;
            if (percent < 60) levelEl.className = "text-xl font-bold text-red-400";
            else if (percent < 70) levelEl.className = "text-xl font-bold text-orange-400";
            else if (percent < 80) levelEl.className = "text-xl font-bold text-yellow-300";
            else levelEl.className = "text-xl font-bold text-emerald-400";
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
    loadAdminBookings: function() {
        document.getElementById('adminBookingsSection').style.display = 'block';
        document.getElementById('adminFilesSection').style.display = 'none';
        document.getElementById('adminUsersSection').style.display = 'none';
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
        document.getElementById('adminUsersSection').style.display = 'none';
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
    },

    loadAdminUsers: function() {
        document.getElementById('adminBookingsSection').style.display = 'none';
        document.getElementById('adminFilesSection').style.display = 'none';
        document.getElementById('adminUsersSection').style.display = 'block';
        this.showLoader('กำลังโหลดรายชื่อผู้ใช้...');

        fetch(CONFIG.GAS_URL + "?action=getUsers")
            .then(res => res.json())
            .then(res => {
                this.hideLoader();
                if(res.status === 'success') this.renderAdminUsers(res.data);
            })
            .catch(err => { this.hideLoader(); alert('โหลดข้อมูลล้มเหลว'); });
    },

    renderAdminUsers: function(users) {
        const tbody = document.querySelector('#adminUsersTable tbody');
        tbody.innerHTML = '';
        if(users.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">ไม่มีข้อมูลผู้ใช้</td></tr>';
            return;
        }

        users.forEach(u => {
            let roleBadge = u.role === 'admin' ? '<span class="badge badge-success">Admin</span>' : '<span class="badge badge-pending">Teacher</span>';
            let btnDelete = `<button class="btn btn-danger" style="padding:5px 10px; font-size:12px; background:#dc3545;" onclick="app.deleteUser(${u.rowIndex}, '${u.username}')">ลบผู้ใช้</button>`;
            
            // ป้องกันไม่ให้ลบตัวเอง
            if(u.username === this.currentUser) btnDelete = `<button class="btn" style="padding:5px 10px; font-size:12px; background:#ccc;" disabled>ตัวเอง</button>`;

            let tr = `<tr>
                <td>${u.username}</td>
                <td>${u.password}</td>
                <td>${u.name}</td>
                <td>${roleBadge}</td>
                <td>${btnDelete}</td>
            </tr>`;
            tbody.innerHTML += tr;
        });
    },

    submitNewUser: function(e) {
        e.preventDefault();
        this.showLoader('กำลังบันทึกผู้ใช้ใหม่...');
        
        const form = e.target;
        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());
        data.action = 'addUser';

        fetch(CONFIG.GAS_URL, {
            method: 'POST',
            body: JSON.stringify(data)
        })
        .then(res => res.json())
        .then(res => {
            if(res.status === 'success') {
                form.reset();
                this.loadAdminUsers();
            } else {
                this.hideLoader();
                alert('เกิดข้อผิดพลาด: ' + res.message);
            }
        })
        .catch(err => { this.hideLoader(); alert('เกิดข้อผิดพลาดในการเชื่อมต่อ'); });
    },

    deleteUser: function(rowIndex, username) {
        if(!confirm(`ยืนยันที่จะลบผู้ใช้งาน "${username}" ใช่หรือไม่?`)) return;
        this.showLoader('กำลังลบข้อมูล...');
        
        fetch(CONFIG.GAS_URL, {
            method: 'POST',
            body: JSON.stringify({ action: 'deleteUser', rowIndex: rowIndex })
        })
        .then(res => res.json())
        .then(res => {
            if(res.status === 'success') this.loadAdminUsers();
            else { this.hideLoader(); alert('เกิดข้อผิดพลาด'); }
        });
    }
};

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    app.init();
});
