import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import authService from "../../services/auth";
import { useAuth } from "../../context/AuthContext";

export default function ClassroomLinkLanding() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { refetchMe } = useAuth();
  const didRunRef = useRef(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) {
      setError("Missing classroomId");
      return;
    }
    if (didRunRef.current) return;
    didRunRef.current = true;

    const run = async () => {
      try {
        await authService.setActiveClassroom(id);
        await refetchMe();
        window.location.replace("/");
      } catch (e) {
        console.error("Failed to activate classroom:", e);
        setError("Unable to open classroom");
      }
    };

    void run();
  }, [id, navigate, refetchMe]);

  return (
    <div className="page">
      <div className="container">
        <div className="card text-center py-12">
          {error ? (
            <>
              <h1 className="heading-lg mb-2">Unable to open classroom</h1>
              <p className="text-text-muted">{error}</p>
            </>
          ) : (
            <>
              <h1 className="heading-lg mb-2">Opening classroom…</h1>
              <p className="text-text-muted">Please wait.</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
