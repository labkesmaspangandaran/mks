/**
 * MKS — setup awal dan menu admin di spreadsheet.
 */

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('MKS')
    .addItem('1. Setup sheet & trigger', 'setup')
    .addSeparator()
    .addItem('Tes koneksi Zoom', 'tesZoom')
    .addItem('Proses rekaman sekarang', 'prosesRekaman')
    .addItem('Kirim pengumuman WA (tes)', 'kirimPengumumanWA')
    .addItem('Bersihkan cache jadwal', 'bersihkanCache')
    .addToUi();
}

function bersihkanCache() {
  invalidateCache_();
}

function setup() {
  const ss = ss_();
  ss.setSpreadsheetTimeZone(TZ);
  Object.keys(HEADERS).forEach(function (name) {
    let sh = ss.getSheetByName(name);
    if (!sh) sh = ss.insertSheet(name);
    const head = HEADERS[name];
    const current = sh.getRange(1, 1, 1, head.length).getValues()[0];
    if (current.join('') === '') {
      sh.getRange(1, 1, 1, head.length).setValues([head]);
    }
    sh.getRange(1, 1, 1, head.length).setFontWeight('bold').setBackground('#FFD60A');
    sh.setFrozenRows(1);
  });

  // Kolom yang harus berupa teks (NIP diawali 0, tanggal yyyy-MM-dd, jam HH:mm).
  sheet_(SHEETS.PEGAWAI).getRange('A:A').setNumberFormat('@');
  sheet_(SHEETS.JADWAL).getRange('B:B').setNumberFormat('@');
  sheet_(SHEETS.JADWAL).getRange('D:D').setNumberFormat('@');
  sheet_(SHEETS.JADWAL).getRange('F:F').setNumberFormat('@');
  sheet_(SHEETS.JADWAL).getRange('H:H').setNumberFormat('@');
  sheet_(SHEETS.JADWAL).getRange('A:A').setNumberFormat('yyyy-mm-dd');
  sheet_(SHEETS.KEHADIRAN).getRange('A:B').setNumberFormat('@');
  sheet_(SHEETS.KEHADIRAN).getRange('E:E').setNumberFormat('yyyy-mm-dd hh:mm');
  sheet_(SHEETS.MATERI).getRange('A:B').setNumberFormat('@');
  sheet_(SHEETS.REKAMAN).getRange('A:A').setNumberFormat('@');
  sheet_(SHEETS.PENGATURAN).getRange('B:B').setNumberFormat('@');

  // Isi Pengaturan yang belum ada.
  const set = sheet_(SHEETS.PENGATURAN);
  const ada = {};
  set.getDataRange().getValues().forEach(function (r) { ada[String(r[0])] = true; });
  DEFAULT_SETTINGS.forEach(function (row) {
    if (!ada[row[0]]) set.appendRow(row);
  });

  // Dropdown NIP pemateri dari sheet Pegawai.
  const rule = SpreadsheetApp.newDataValidation()
    .requireValueInRange(sheet_(SHEETS.PEGAWAI).getRange('A2:A'), true)
    .setAllowInvalid(false)
    .build();
  ['B2:B', 'D2:D', 'F2:F', 'H2:H'].forEach(function (a1) {
    sheet_(SHEETS.JADWAL).getRange(a1).setDataValidation(rule);
  });

  pasangTrigger_();
  SETTINGS_MEMO_ = null;

  try {
    SpreadsheetApp.getUi().alert('Setup selesai. Lengkapi sheet Pengaturan dan Script Properties sesuai panduan.');
  } catch (e) { /* dijalankan dari editor */ }
}

function pasangTrigger_() {
  const handlers = ['prosesRekaman', 'kirimPengumumanWA'];
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (handlers.indexOf(t.getHandlerFunction()) >= 0) ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('prosesRekaman').timeBased().everyMinutes(30).create();
  // Trigger mingguan berjalan dalam rentang jam 09.00–10.00.
  ScriptApp.newTrigger('kirimPengumumanWA').timeBased().onWeekDay(ScriptApp.WeekDay.THURSDAY).atHour(9).nearMinute(0).create();
}

function tesZoom() {
  let pesan;
  try {
    const list = listRekamanZoom_(30);
    pesan = 'Koneksi Zoom OK. Rekaman meeting MKS 30 hari terakhir: ' + list.length + '\n' +
      list.map(function (m) { return '• ' + m.start_time + ' (' + (m.recording_files || []).length + ' file)'; }).join('\n');
  } catch (e) {
    pesan = 'Koneksi Zoom gagal: ' + e.message;
  }
  try {
    SpreadsheetApp.getUi().alert(pesan);
  } catch (e) {
    console.log(pesan);
  }
}
