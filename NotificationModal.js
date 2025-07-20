function NotificationModal({ message, onClose }) {
  const [show, setShow] = React.useState(false);
  const timerRef = React.useRef(null);

  React.useEffect(() => {
    if (message) {
      setShow(true);
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      timerRef.current = setTimeout(() => {
        setShow(false);
        setTimeout(onClose, 500); // 500ms for slide-up/fade-out animation
      }, 10000); // Display for 10 seconds
    } else {
      setShow(false);
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    }

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [message, onClose]);

  if (!show && !message) return null;

  return (
    <div
      className={`fixed top-0 left-0 right-0 z-50 flex justify-center p-4 transition-transform duration-500 ease-out ${
        show ? 'translate-y-0' : '-translate-y-full'
      }`}
      style={{ pointerEvents: 'none' }}
    >
      <div
        className="bg-[#3A8D41] text-white px-6 py-3 rounded-lg shadow-lg max-w-md w-full text-center"
        style={{ pointerEvents: 'auto' }}
      >
        <p className="font-semibold">{message}</p>
      </div>
    </div>
  );
}

export default NotificationModal;
