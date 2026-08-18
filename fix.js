const fs = require('fs');
const path = 'C:/Users/anura/Pictures/anurak9/nited_project/backend/Code.gs';
let data = fs.readFileSync(path, 'utf8');

data = data.replace('ss = SpreadsheetApp.create(???????????????? Database);', 'ss = SpreadsheetApp.create(\'ระบบนิเทศออนไลน์ Database\');');
data = data.replace('props.getProperty(SHEET_ID);', 'props.getProperty(\'SHEET_ID\');');
data = data.replace('setProperty(SHEET_ID, ss.getId());', 'setProperty(\'SHEET_ID\', ss.getId());');

fs.writeFileSync(path, data);
