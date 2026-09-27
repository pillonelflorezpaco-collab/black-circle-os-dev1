import { reportRepository } from "@/repositories/report.repository";

export async function listReports(agencyId: string) {
  return reportRepository.findMany(agencyId);
}
