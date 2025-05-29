import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCoffee, faEnvelope } from "@fortawesome/free-solid-svg-icons";

export default function Footer() {
  return (
    <footer className="bg-gray-800 text-gray-400 py-10">
      <div className="container mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="text-sm">
          © 2025 VolMagique •{" "}
          <a href="/terms" className="hover:text-white">
            CGU
          </a>{" "}
          •{" "}
          <a href="/privacy" className="hover:text-white">
            Confidentialité
          </a>
        </div>
        <div className="flex items-center gap-4">
          <a href="mailto:deals.volmagique@gmail.com" aria-label="Contact">
            <FontAwesomeIcon icon={faEnvelope} />
          </a>
        </div>
      </div>
    </footer>
  );
}
