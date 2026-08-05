import { ProgressSpinner } from "primereact/progressspinner";

interface Props {
  loading?: boolean;
}

function LoadingOverlay(props: Props) {
  const { loading } = props;

  if (!loading) return null;

  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-xs flex items-center justify-center z-[99999]">
      <div className="flex flex-col items-center">
        <ProgressSpinner
          style={{ width: "75px", height: "75px" }}
          strokeWidth="4"
        />
        <span className="text-white text-base mt-2">Loading...</span>
      </div>
    </div>
  );
}

export default LoadingOverlay;
