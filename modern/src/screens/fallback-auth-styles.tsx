// Only requested for routes without the exact compiled Main stylesheet.
// The parent router Suspense also suspends the auth layout until CSS is ready.
import styles from "../auth.css?inline"
export default function FallbackAuthStyles(){return <style>{styles}</style>}
