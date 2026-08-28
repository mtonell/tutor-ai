export default function TutorOrb({ isRecording, isSpeaking, onToggle }) {
  let orbClass = "tutor-orb";
  if (isRecording) {
     if (isSpeaking) {
        orbClass += " speaking";
     } else {
        orbClass += " listening";
     }
  }

  return (
    <div className="tutor-orb-container">
      <button 
        className={orbClass}
        onClick={onToggle}
      >
        {isRecording ? 'Stop' : 'Start Conversation'}
      </button>
    </div>
  );
}
