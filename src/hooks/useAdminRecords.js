import { useEffect, useState } from "react";
import { api } from "../api/client.js";
import { useAuth } from "../context/AuthContext.jsx";

export default function useAdminRecords(path) {
  const { token } = useAuth();
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState({ data: null, error: "", loading: true });

  useEffect(() => {
    const controller = new AbortController();
    setState({ data: null, error: "", loading: true });
    api(path, { token, signal: controller.signal })
      .then((data) => {
        if (!controller.signal.aborted)
          setState({ data, error: "", loading: false });
      })
      .catch((error) => {
        if (!controller.signal.aborted)
          setState({ data: null, error: error.message, loading: false });
      });
    return () => controller.abort();
  }, [path, token, revision]);

  return { ...state, reload: () => setRevision((value) => value + 1) };
}
