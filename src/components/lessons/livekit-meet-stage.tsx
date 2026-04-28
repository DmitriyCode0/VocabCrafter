"use client";

import {
  ConnectionStateToast,
  ControlBar,
  ParticipantTile,
  RoomAudioRenderer,
  RoomContext,
  StartAudio,
  isTrackReference,
  useTracks,
  type TrackReferenceOrPlaceholder,
} from "@livekit/components-react";
import { RoomEvent, Track, type Room } from "livekit-client";
import { cn } from "@/lib/utils";

interface LiveKitMeetStageProps {
  room: Room;
  allowScreenShare?: boolean;
  className?: string;
  stageRef?: React.Ref<HTMLDivElement>;
}

function getTrackLabel(trackRef: TrackReferenceOrPlaceholder) {
  const baseLabel =
    trackRef.participant.isLocal
      ? "You"
      : trackRef.participant.name || trackRef.participant.identity;

  return trackRef.source === Track.Source.ScreenShare
    ? `${baseLabel} screen`
    : baseLabel;
}

function MeetParticipantTile({
  trackRef,
}: {
  trackRef: TrackReferenceOrPlaceholder;
}) {
  return (
    <div
      data-pip-label={getTrackLabel(trackRef)}
      data-pip-participant-type={trackRef.participant.isLocal ? "local" : "remote"}
      data-pip-track-kind={
        trackRef.source === Track.Source.ScreenShare ? "screen" : "camera"
      }
      className={cn(
        "group relative overflow-hidden rounded-[1.75rem] border border-white/10 bg-neutral-950 shadow-[0_28px_80px_-36px_rgba(0,0,0,0.9)]",
        "before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-24 before:bg-gradient-to-b before:from-white/10 before:to-transparent before:content-['']",
      )}
    >
      <ParticipantTile
        trackRef={trackRef}
        className="h-full min-h-[220px] bg-neutral-950 [&_.lk-participant-placeholder]:bg-neutral-900 [&_.lk-participant-placeholder]:text-white/70 [&_.lk-participant-tile]:h-full [&_.lk-participant-tile]:min-h-[220px] [&_.lk-participant-tile]:rounded-[1.75rem] [&_.lk-participant-tile]:border-0 [&_.lk-participant-tile]:bg-transparent [&_.lk-video-conference]:bg-transparent"
      />
    </div>
  );
}

function MeetStageLayout() {
  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    {
      updateOnlyOn: [RoomEvent.ActiveSpeakersChanged],
      onlySubscribed: false,
    },
  );

  const screenShareTracks = tracks.filter(
    (trackRef) =>
      isTrackReference(trackRef) &&
      trackRef.publication.source === Track.Source.ScreenShare,
  );
  const primaryTrack = screenShareTracks[0] ?? tracks[0] ?? null;
  const secondaryTracks = tracks.filter((trackRef) => trackRef !== primaryTrack);

  if (!primaryTrack) {
    return (
      <div className="flex min-h-[420px] items-center justify-center rounded-[2rem] border border-dashed border-white/10 bg-neutral-950/80 px-6 py-10 text-center text-sm text-white/60">
        Join the room to start publishing audio and video.
      </div>
    );
  }

  if (secondaryTracks.length === 0) {
    return (
      <div className="min-h-[420px]">
        <MeetParticipantTile trackRef={primaryTrack} />
      </div>
    );
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(320px,0.75fr)]">
      <div className="min-h-[420px]">
        <MeetParticipantTile trackRef={primaryTrack} />
      </div>
      <div className="grid auto-rows-fr gap-4 sm:grid-cols-2 xl:grid-cols-1">
        {secondaryTracks.map((trackRef) => {
          const trackKey = isTrackReference(trackRef)
            ? trackRef.publication.trackSid
            : `${trackRef.participant.identity}-${trackRef.source}-placeholder`;

          return <MeetParticipantTile key={trackKey} trackRef={trackRef} />;
        })}
      </div>
    </div>
  );
}

export function LiveKitMeetStage({
  room,
  allowScreenShare = false,
  className,
  stageRef,
}: LiveKitMeetStageProps) {
  return (
    <div
      ref={stageRef}
      data-lk-theme="default"
      className={cn(
        "lk-room-container overflow-hidden rounded-[2rem] border border-border/60 bg-[radial-gradient(circle_at_top,_rgba(74,222,128,0.12),_transparent_35%),linear-gradient(180deg,_rgba(10,15,12,0.92),_rgba(3,7,4,0.98))] p-4 text-white shadow-[0_36px_120px_-48px_rgba(0,0,0,0.85)] sm:p-5",
        className,
      )}
    >
      <RoomContext.Provider value={room}>
        <div className="relative space-y-4">
          <div className="absolute inset-x-0 top-0 z-10 flex justify-start p-2">
            <StartAudio
              label="Allow audio"
              className="lk-button rounded-full border border-white/10 bg-black/60 px-4 py-2 text-xs font-medium text-white backdrop-blur"
            />
          </div>

          <MeetStageLayout />

          <div className="rounded-[1.5rem] border border-white/10 bg-black/35 px-3 py-3 backdrop-blur sm:px-4">
            <ControlBar
              controls={{
                microphone: true,
                camera: true,
                screenShare: allowScreenShare,
                chat: false,
                settings: false,
                leave: false,
              }}
              className="!justify-center"
            />
          </div>
        </div>

        <RoomAudioRenderer />
        <ConnectionStateToast />
      </RoomContext.Provider>
    </div>
  );
}