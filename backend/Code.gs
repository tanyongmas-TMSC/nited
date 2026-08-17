/**
 * โค้ด Backend (Google Apps Script) สำหรับระบบนิเทศออนไลน์ โรงเรียนตันหยงมัส
 * วิธีใช้งาน:
 * 1. คัดลอกโค้ดทั้งหมดนี้ไปวางใน https://script.google.com/ (ลบโค้ดเก่าออกก่อน)
 * 2. กดปุ่มบันทึก (Save)
 * 3. เลือกฟังก์ชัน `setupSystem` ด้านบน แล้วกดปุ่ม `รัน (Run)`
 * 4. กดยอมรับสิทธิ์การเข้าถึงบัญชี Google ของคุณให้เรียบร้อย
 * 5. หลังจากรันเสร็จเรียบร้อย ให้กดเมนู "การทำให้ใช้งานได้" (Deploy) -> "การสร้างการทำให้ใช้งานได้ใหม่" (New deployment)
 * 6. เลือกประเภท "เว็บแอป" (Web App)
 *    - สิทธิ์การเข้าถึง: "ทุกคน" (Anyone)
 * 7. กด "การทำให้ใช้งานได้" (Deploy) แล้วคัดลอก Web App URL ไปใส่ในเว็บ Frontend
 */

function setupSystem() {
  const props = PropertiesService.getScriptProperties();
  
  // 1. สร้าง Google Sheets
  const ss = SpreadsheetApp.create('Supervision_Database');
  props.setProperty('SPREADSHEET_ID', ss.getId());
  
  // สร้าง Sheet 1: Booking
  let sheetBooking = ss.getSheets()[0];
  sheetBooking.setName('Booking');
  sheetBooking.appendRow(['Timestamp', 'Date', 'Time', 'Teacher Name', 'Department', 'Period', 'Subject Name', 'Subject Code', 'Class Level', 'Room', 'Status']);
  
  // สร้าง Sheet 2: Files
  let sheetFiles = ss.insertSheet('Files');
  sheetFiles.appendRow(['Timestamp', 'Teacher Name', 'File Type', 'File URL/Link', 'Drive File ID', 'Status']);
  
  // สร้าง Sheet 3: Supervision
  let sheetSupervision = ss.insertSheet('Supervision');
  sheetSupervision.appendRow(['Timestamp', 'Teacher Name', 'Supervision Date', 'Strengths', 'Improvements', 'Suggestions', 'Summary']);
  
  // 2. สร้างโฟลเดอร์ใน Google Drive
  let rootFolder = DriveApp.createFolder('Supervision-System-Folder');
  props.setProperty('ROOT_FOLDER_ID', rootFolder.getId());
  
  let plansFolder = rootFolder.createFolder('Plans');
  props.setProperty('PLANS_FOLDER_ID', plansFolder.getId());
  
  let mediaFolder = rootFolder.createFolder('Media');
  props.setProperty('MEDIA_FOLDER_ID', mediaFolder.getId());
  
  let photosFolder = rootFolder.createFolder('Photos');
  props.setProperty('PHOTOS_FOLDER_ID', photosFolder.getId());
  
  let clipsFolder = rootFolder.createFolder('Clips');
  props.setProperty('CLIPS_FOLDER_ID', clipsFolder.getId());
  
  Logger.log('การสร้างฐานข้อมูลและโฟลเดอร์เสร็จสมบูรณ์!');
  Logger.log('Spreadsheet ID: ' + ss.getId());
}

// -------------------------------------------------------------
// API ENDPOINTS
// -------------------------------------------------------------

function doPost(e) {
  return handleRequest(e, 'POST');
}

function doGet(e) {
  return handleRequest(e, 'GET');
}

function handleRequest(e, method) {
  // รองรับ CORS สำหรับเรียกใช้จากภายนอก
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
  
  try {
    let action = e.parameter.action;
    let data;
    
    if (method === 'POST') {
      data = JSON.parse(e.postData.contents);
      action = data.action || action;
    }
    
    let result = {};
    
    switch (action) {
      case 'getStats':
        result = getStats();
        break;
      case 'getBookings':
        result = getBookings();
        break;
      case 'createBooking':
        result = createBooking(data);
        break;
      case 'uploadFile':
        result = uploadFile(data);
        break;
      case 'getFiles':
        result = getFiles();
        break;
      case 'submitEvaluation':
        result = submitEvaluation(data);
        break;
      case 'updateBookingStatus':
        result = updateBookingStatus(data);
        break;
      case 'updateFileStatus':
        result = updateFileStatus(data);
        break;
      default:
        result = { status: 'error', message: 'Action not found' };
    }
    
    return ContentService.createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: error.toString(), stack: error.stack }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// -------------------------------------------------------------
// FUNCTIONS
// -------------------------------------------------------------

function getSpreadsheet() {
  const id = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  if (!id) throw new Error("ระบบยังไม่ได้รับการ Setup กรุณารัน setupSystem ก่อน");
  return SpreadsheetApp.openById(id);
}

function getStats() {
  const ss = getSpreadsheet();
  const sheetBooking = ss.getSheetByName('Booking');
  const sheetFiles = ss.getSheetByName('Files');
  
  const bookingsData = sheetBooking.getDataRange().getValues();
  const filesData = sheetFiles.getDataRange().getValues();
  
  let totalBookings = 0;
  let supervisedCount = 0;
  let pendingFiles = 0;
  
  // ข้าม header row (index 0)
  for (let i = 1; i < bookingsData.length; i++) {
    if (bookingsData[i][0] !== "") totalBookings++;
    if (bookingsData[i][10] === "นิเทศแล้ว") supervisedCount++;
  }
  
  for (let i = 1; i < filesData.length; i++) {
    if (filesData[i][5] === "รอตรวจสอบ") pendingFiles++;
  }
  
  return {
    status: 'success',
    data: {
      totalBookings: totalBookings,
      supervisedCount: supervisedCount,
      pendingFiles: pendingFiles
    }
  };
}

function getBookings() {
  const sheet = getSpreadsheet().getSheetByName('Booking');
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const results = [];
  
  for (let i = 1; i < data.length; i++) {
    let row = data[i];
    if (row[0] === "") continue;
    let obj = {};
    for (let j = 0; j < headers.length; j++) {
      obj[headers[j]] = row[j];
    }
    obj.rowIndex = i + 1; // สำหรับใช้อ้างอิงแถวเวลาแก้ไข
    results.push(obj);
  }
  
  return { status: 'success', data: results };
}

function createBooking(data) {
  const sheet = getSpreadsheet().getSheetByName('Booking');
  const timestamp = new Date();
  const status = 'รอดำเนินการ'; // Default status
  
  sheet.appendRow([
    timestamp,
    data.date,
    data.time,
    data.teacherName,
    data.department,
    data.period,
    data.subjectName,
    data.subjectCode,
    data.classLevel,
    data.room,
    status
  ]);
  
  return { status: 'success', message: 'บันทึกการจองสำเร็จ' };
}

function uploadFile(data) {
  const props = PropertiesService.getScriptProperties();
  const timestamp = new Date();
  
  let folderId;
  let fileType = data.fileType;
  
  // เลือกโฟลเดอร์ตามประเภทไฟล์
  if (fileType === 'แผนการสอน') folderId = props.getProperty('PLANS_FOLDER_ID');
  else if (fileType === 'สื่อการสอน') folderId = props.getProperty('MEDIA_FOLDER_ID');
  else if (fileType === 'ภาพกิจกรรม') folderId = props.getProperty('PHOTOS_FOLDER_ID');
  
  let fileUrl = "";
  let driveFileId = "";
  
  // กรณีไม่ใช่ลิงก์คลิปวิดีโอ (เป็นไฟล์ Base64)
  if (fileType !== 'คลิปวิดีโอ' && data.fileData) {
    const folder = DriveApp.getFolderById(folderId);
    const splitBase = data.fileData.split(',');
    const type = splitBase[0].split(';')[0].replace('data:', '');
    const byteCharacters = Utilities.base64Decode(splitBase[1]);
    const blob = Utilities.newBlob(byteCharacters, type, data.fileName);
    
    const newFile = folder.createFile(blob);
    newFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    
    fileUrl = newFile.getUrl();
    driveFileId = newFile.getId();
  } else if (fileType === 'คลิปวิดีโอ') {
    // กรณีคลิป รับมาเป็น Link โดยตรง
    fileUrl = data.fileLink;
    driveFileId = "LINK_ONLY";
  }
  
  // บันทึกลง Sheet
  const sheet = getSpreadsheet().getSheetByName('Files');
  sheet.appendRow([
    timestamp,
    data.teacherName,
    fileType,
    fileUrl,
    driveFileId,
    'รอตรวจสอบ'
  ]);
  
  return { status: 'success', message: 'ส่งไฟล์สำเร็จ', fileUrl: fileUrl };
}

function getFiles() {
  const sheet = getSpreadsheet().getSheetByName('Files');
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const results = [];
  
  for (let i = 1; i < data.length; i++) {
    let row = data[i];
    if (row[0] === "") continue;
    let obj = {};
    for (let j = 0; j < headers.length; j++) {
      obj[headers[j]] = row[j];
    }
    obj.rowIndex = i + 1;
    results.push(obj);
  }
  
  return { status: 'success', data: results };
}

function submitEvaluation(data) {
  const sheet = getSpreadsheet().getSheetByName('Supervision');
  const timestamp = new Date();
  
  sheet.appendRow([
    timestamp,
    data.teacherName,
    data.supervisionDate,
    data.strengths,
    data.improvements,
    data.suggestions,
    data.summaryLevel
  ]);
  
  return { status: 'success', message: 'บันทึกการประเมินสำเร็จ' };
}

function updateBookingStatus(data) {
  const sheet = getSpreadsheet().getSheetByName('Booking');
  // Column 11 คือ Status (Index เริ่มต้น 1)
  sheet.getRange(data.rowIndex, 11).setValue(data.status);
  return { status: 'success', message: 'อัปเดตสถานะการจองสำเร็จ' };
}

function updateFileStatus(data) {
  const sheet = getSpreadsheet().getSheetByName('Files');
  // Column 6 คือ Status
  sheet.getRange(data.rowIndex, 6).setValue(data.status);
  return { status: 'success', message: 'อัปเดตสถานะไฟล์สำเร็จ' };
}
