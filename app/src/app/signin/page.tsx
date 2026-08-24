// The first screen (ADR-0007 decision 6). A real route, not an overlay: a modal
// over a workspace you are not meant to touch yet is a lie the DOM tells — the
// app underneath is fully loaded and interactive. A route also gives the OAuth
// callback somewhere real to land and makes the back button behave.
import SignInScreen from "./SignInScreen";

export default function Page() {
  return <SignInScreen />;
}
