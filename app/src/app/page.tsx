// The single route. Everything below it is a client application; this server
// component exists only to hand off to it.
import ClientApp from "./ClientApp";

export default function Page() {
  return <ClientApp />;
}
