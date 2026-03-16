export type Exam = {
  id: number, // Eindeutige ID im BiP.
  examName: string, // Name der Prüfung wie sie am Client dargstellt werden soll.
  examdate: string, // Geplanter Beginn der Prüfung.
  examDurationMinutes: number, // Dauer der Prüfung in Minuten.
  examStatus: string,
  examPin: number,
  examTeachers: Teacher[],
  version: string,
}

export type Teacher = {
  teacherID: number, // BiP-ID der Lehrperson.
  teacherIP: string | null, // Automatisch gesetzt sobald der Lehrer eine Prüfung im BiP startet.
  manager: boolean,
}
