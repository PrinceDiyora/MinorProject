import Navbar from "./LandingPage/Navbar";
import Hero from "./LandingPage/Hero";
import Features from "./LandingPage/Features";
import Testimonials from "./LandingPage/Testimonials";
import FinalCTA from "./LandingPage/FinalCTA";
import Footer from "./LandingPage/Footer";

export default function LandingPage() {
  return (
    <div style={{ fontFamily: "'Roboto', sans-serif", color: "var(--navy)", overflowX: "hidden" }}>
      <Navbar />
      <Hero />
      <Features />
      <Testimonials />
      <FinalCTA />
      <Footer />
    </div>
  );
}