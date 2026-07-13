import { reportRepository } from "@/repositories/report.repository";

export async function listReports() {
  return reportRepository.findMany();
}
