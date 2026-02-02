// Level map showing room grid with progress

import { Fragment } from 'react';
import type { Level, Room, BossRoom } from '../../types/level';

interface LevelMapProps {
  level: Level;
  currentRoomIndex: number;
  completedRooms: number[];
  onRoomSelect: (roomIndex: number) => void;
  className?: string;
}

// Single room on the map
function MapRoom({
  room,
  index,
  isCurrent,
  isCompleted,
  isLocked,
  isBoss,
  onClick,
}: {
  room: Room | BossRoom;
  index: number;
  isCurrent: boolean;
  isCompleted: boolean;
  isLocked: boolean;
  isBoss: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={isLocked}
      className={`
        relative w-16 h-16 rounded-lg border-2 transition-all
        flex items-center justify-center
        ${isCurrent ? 'border-blue-500 bg-blue-900/50 ring-2 ring-blue-500 ring-offset-2 ring-offset-gray-900' : ''}
        ${isCompleted && !isCurrent ? 'border-green-500 bg-green-900/30' : ''}
        ${!isCurrent && !isCompleted && !isLocked ? 'border-gray-600 bg-gray-800 hover:border-gray-500 hover:bg-gray-700' : ''}
        ${isLocked ? 'border-gray-700 bg-gray-800/50 cursor-not-allowed' : 'cursor-pointer'}
        ${isBoss ? 'border-red-500 bg-red-900/30' : ''}
      `}
    >
      {/* Room number or boss indicator */}
      <span
        className={`
          text-xl font-bold
          ${isBoss ? 'text-red-400' : isCompleted ? 'text-green-400' : isCurrent ? 'text-blue-400' : 'text-gray-400'}
          ${isLocked ? 'opacity-50' : ''}
        `}
      >
        {isBoss ? 'B' : index + 1}
      </span>

      {/* Completion checkmark */}
      {isCompleted && (
        <div className="absolute -top-1 -right-1 w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
        </div>
      )}

      {/* Lock indicator */}
      {isLocked && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900/50 rounded-lg">
          <svg className="w-6 h-6 text-gray-500" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z"
              clipRule="evenodd"
            />
          </svg>
        </div>
      )}

      {/* Current indicator pulse */}
      {isCurrent && (
        <div className="absolute inset-0 rounded-lg border-2 border-blue-400 animate-ping opacity-30" />
      )}
    </button>
  );
}

// Connection line between rooms
function RoomConnection({
  isCompleted,
  isActive,
}: {
  isCompleted: boolean;
  isActive: boolean;
}) {
  return (
    <div className="flex items-center justify-center w-8">
      <div
        className={`
          h-1 w-full rounded
          ${isCompleted ? 'bg-green-500' : isActive ? 'bg-blue-500' : 'bg-gray-700'}
        `}
      >
        {isActive && !isCompleted && (
          <div className="h-full w-2 bg-blue-400 rounded animate-pulse" />
        )}
      </div>
    </div>
  );
}

export function LevelMap({
  level,
  currentRoomIndex,
  completedRooms,
  onRoomSelect,
  className = '',
}: LevelMapProps) {
  const allRooms = [...level.rooms, ...(level.bossRoom ? [level.bossRoom] : [])];
  const totalRooms = allRooms.length;

  // Calculate progress percentage
  const progressPercent = (completedRooms.length / totalRooms) * 100;

  return (
    <div className={`bg-gray-800 rounded-lg p-4 ${className}`}>
      {/* Level header */}
      <div className="mb-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-white">{level.name}</h2>
          <div className="flex items-center gap-2">
            {/* Difficulty stars */}
            <div className="flex gap-0.5">
              {Array.from({ length: 5 }).map((_, i) => (
                <svg
                  key={i}
                  className={`w-4 h-4 ${i < level.difficulty ? 'text-amber-400' : 'text-gray-600'}`}
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
              ))}
            </div>
          </div>
        </div>
        <p className="text-sm text-gray-400 mt-1">{level.description}</p>
      </div>

      {/* Progress bar */}
      <div className="mb-4">
        <div className="flex justify-between text-xs text-gray-400 mb-1">
          <span>Progress</span>
          <span>
            {completedRooms.length} / {totalRooms} rooms
          </span>
        </div>
        <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-green-500 transition-all duration-500"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Room map */}
      <div className="flex flex-wrap items-center justify-center gap-y-4">
        {allRooms.map((room, index) => {
          const isCompleted = completedRooms.includes(index);
          const isCurrent = index === currentRoomIndex;
          const isLocked = index > 0 && !completedRooms.includes(index - 1) && !isCurrent;
          const isBoss = index === level.rooms.length && level.bossRoom !== undefined;

          return (
            <Fragment key={room.id}>
              <MapRoom
                room={room}
                index={index}
                isCurrent={isCurrent}
                isCompleted={isCompleted}
                isLocked={isLocked}
                isBoss={isBoss}
                onClick={() => !isLocked && onRoomSelect(index)}
              />
              {index < allRooms.length - 1 && (
                <RoomConnection
                  isCompleted={completedRooms.includes(index)}
                  isActive={index === currentRoomIndex}
                />
              )}
            </Fragment>
          );
        })}
      </div>

      {/* Star thresholds */}
      <div className="mt-4 pt-4 border-t border-gray-700">
        <div className="flex items-center justify-between text-xs">
          <span className="text-gray-400">Star rewards:</span>
          <div className="flex gap-3">
            <span className="text-gray-300">
              1 = {level.starThresholds.one}
            </span>
            <span className="text-gray-300">
              2 = {level.starThresholds.two}
            </span>
            <span className="text-amber-300">
              3 = {level.starThresholds.three}
            </span>
          </div>
        </div>
      </div>

      {/* Concepts taught */}
      {level.concepts.length > 0 && (
        <div className="mt-3">
          <div className="text-xs text-gray-400 mb-1">Concepts:</div>
          <div className="flex flex-wrap gap-1">
            {level.concepts.map((concept) => (
              <span
                key={concept}
                className="px-2 py-0.5 bg-blue-900/30 text-blue-300 text-xs rounded"
              >
                {concept}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Level selection card for level list
export function LevelCard({
  level,
  progress,
  isUnlocked,
  onSelect,
}: {
  level: Level;
  progress?: { stars: number; completedRooms: number };
  isUnlocked: boolean;
  onSelect: () => void;
}) {
  const totalRooms = level.rooms.length + (level.bossRoom ? 1 : 0);
  const completedRooms = progress?.completedRooms || 0;
  const stars = progress?.stars || 0;

  return (
    <button
      onClick={onSelect}
      disabled={!isUnlocked}
      className={`
        w-full text-left p-4 rounded-lg border-2 transition-all
        ${isUnlocked ? 'bg-gray-800 border-gray-700 hover:border-gray-600 hover:bg-gray-750 cursor-pointer' : 'bg-gray-900 border-gray-800 cursor-not-allowed opacity-60'}
      `}
    >
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-bold text-white">{level.name}</h3>
          <p className="text-sm text-gray-400 mt-1">{level.description}</p>
        </div>
        {!isUnlocked && (
          <svg className="w-6 h-6 text-gray-500" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z"
              clipRule="evenodd"
            />
          </svg>
        )}
      </div>

      <div className="mt-3 flex items-center justify-between">
        {/* Difficulty */}
        <div className="flex gap-0.5">
          {Array.from({ length: 5 }).map((_, i) => (
            <svg
              key={i}
              className={`w-4 h-4 ${i < level.difficulty ? 'text-amber-400' : 'text-gray-600'}`}
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
          ))}
        </div>

        {/* Progress */}
        {progress && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">
              {completedRooms}/{totalRooms}
            </span>
            <div className="flex gap-0.5">
              {Array.from({ length: 3 }).map((_, i) => (
                <svg
                  key={i}
                  className={`w-4 h-4 ${i < stars ? 'text-amber-400' : 'text-gray-600'}`}
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Required level */}
      {!isUnlocked && (
        <div className="mt-2 text-xs text-gray-500">
          Requires level {level.requiredLevel}
        </div>
      )}
    </button>
  );
}

// ============================================
// Backwards Compatibility Aliases
// ============================================

/** @deprecated Use LevelMap instead */
export const DungeonMap = LevelMap;
/** @deprecated Use LevelCard instead */
export const DungeonCard = LevelCard;
