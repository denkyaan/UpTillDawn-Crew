import PortalPage from "../[portal]/page"

export const dynamic = "force-dynamic"

export default function AdministrationHome(){
 return PortalPage({params:Promise.resolve({portal:"administration"})})
}
