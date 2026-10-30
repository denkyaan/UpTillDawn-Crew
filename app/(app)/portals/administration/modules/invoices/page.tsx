import FinancePage from "../../finance/page"
export const dynamic="force-dynamic"
export default function Page(){return FinancePage({searchParams:Promise.resolve({})})}
