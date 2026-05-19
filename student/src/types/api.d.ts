export type Exam = {
  id: number, // Unique ID in BiP.
  examName: string, // Name of the exam as displayed to the client.
  examdate: string, // Scheduled start of the exam.
  examDurationMinutes: number, // Duration of the exam in minutes.
  examStatus: string,
  requireBiP?: boolean,
  examPin: number,
  examTeachers: Teacher[],
  version: string,
}

export type Teacher = {
  teacherID: number, // BiP ID of the teacher.
  teacherIP: string | null, // Automatically set when the teacher starts an exam in BiP.
  manager: boolean,
}
