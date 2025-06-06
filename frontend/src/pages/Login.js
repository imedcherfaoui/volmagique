import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  auth,
  sendSignInLinkToEmail,
  isSignInWithEmailLink,
  signInWithEmailLink,
} from "../firebase";
import { Button } from "../components/ui/button";
import { onAuthStateChanged } from "firebase/auth";

// Magic link redirect back here → then go to /dashboard
const actionCodeSettings = {
  url: window.location.origin + "/login", // land back on /login first
  handleCodeInApp: true,
};

export default function Login() {
  const [email, setEmail] = useState("");
  const nav = useNavigate();

  // 1) Redirect if already signed in
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) nav("/dashboard", { replace: true });
    });
    return unsubscribe;
  }, [nav]);

  // 2) Handle arrival via magic link
  useEffect(() => {
    if (isSignInWithEmailLink(auth, window.location.href)) {
      const savedEmail = window.localStorage.getItem("emailForSignIn");
      signInWithEmailLink(auth, savedEmail, window.location.href)
        .then(async () => {
          window.localStorage.removeItem("emailForSignIn");
          // ─── NEW: register this user in Firestore + SendGrid ─────────────────────
          try {
            await fetch(`${process.env.REACT_APP_API_URL}/subscribe`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ email: savedEmail }),
            });
          } catch (err) {
            console.error("Auto-subscribe failed:", err);
          }
          // ────────────────────────────────────────────────────────────────────────
          nav("/dashboard", { replace: true });
        })
        .catch(console.error);
    }
  }, [nav]);

  // 3) Send the magic link
  const handleSubmit = async (e) => {
    e.preventDefault();
    await sendSignInLinkToEmail(auth, email, actionCodeSettings);
    window.localStorage.setItem("emailForSignIn", email);
    alert(
      "✔️ Un lien de connexion a été envoyé à votre email. Veuillez vérifier votre boîte de réception ou dossier spam."
    );
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="max-w-md mx-auto p-6 space-y-4 text-center"
    >
      <h2 className="text-xl font-bold">
        Se connecter / S'inscrire
      </h2>
      <input
        type="email"
        required
        placeholder="Entrez votre email ici pour vous connecter"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="w-full p-2 border rounded"
      />
      <Button type="submit">Envoyer le lien</Button>
      <p className="text-sm text-gray-500">
        En vous connectant, vous allez recevoir un email avec un lien magique. Cliquez dessus pour vous connecter.
        <br />
        Si vous ne recevez pas l'email, vérifiez votre dossier spam ou essayez une autre adresse.
      </p>
    </form>
  );
}
