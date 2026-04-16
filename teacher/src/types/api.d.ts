export type Exam = {
  lastUpdate: number,
  bip: boolean,
  id: number, // Eindeutige ID im BiP.
  nextexamVersion: string,
  examName: string, // Name der Prüfung wie sie am Client dargstellt werden soll.
  examPassword: number, // Remove?
  examDate: string, // Geplanter Beginn der Prüfung.
  examDurationMinutes: number, // Dauer der Prüfung in Minuten.
  pin: number,
  requireBiP: boolean, // Remove?
  exammode: boolean, // Remove?
  delfolderonexit: boolean, // Remove?
  screenshotinterval: number,
  backupintervalPause: number,
  screenslocked: boolean, // Remove?
  screenshotocr: boolean, // Remove?
  examStudents: Student[],
  examTeachers: Teacher[],
  examSecurityKey: string | null, // Remove?
  useExamSections: boolean,
  activeSection: number, // Remove?
  lockedSection: number, // Remove?
  examSections: Section[],
}

export type Student = {
  studentID: number,
  studentName: string,
  studentSeat: number | null,
}

export type Teacher = {
  teacherID: number, // BiP-ID der Lehrperson.
  teacherIP: string | null, // Automatisch gesetzt sobald der Lehrer eine Prüfung im BiP startet.
  manager: boolean,
}

export type Section = {
  examtype: string,
  timelimit: number, // Remove?
  locked: boolean, // Remove?
  sectionname: string,
  spellchecklang: string | null,
  suggestions: boolean | null,
  moodleTestId: number | null,
  moodleDomain: string | null,
  moodleURL: string | null,
  cmargin: Margin[],
  formsUrl: string | null,
  msOfficeFile: boolean | null, // Remove?
  linespacing: number | null,
  languagetool: boolean | null,
  fontfamily: string | null,
  fontsize: number | null,
  audioRepeat: number | null,
  domainname: string | null,
  blockSubdomains: boolean | null,
  blockSubfolders: boolean | null,
  rdpConfig: null, // Remove?
  localVMConfig: any,
  groups: boolean,
  groupA: Group,
  groupB: Group,
}

export type Margin = {
  side: string | null,
  size: number | null,
}

export type Group = {
  users: number[],
  examInstructionFiles: File[],
  allowedUrls: Url[],
}

export type File = {
  filename: string,
  filetype: string,
  filecontent: string,
  checksum: string,
}

export type Url = {
  url: string,
  blockSubdomains: boolean,
  blockSubfolders: boolean,
}
