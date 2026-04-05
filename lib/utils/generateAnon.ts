const adjectives = [
  'Silent', 'Midnight', 'Shadow', 'Crystal', 'Neon', 'Storm',
  'Phantom', 'Ghost', 'Digital', 'Cyber', 'Void', 'Dark',
  'Blazing', 'Wild', 'Lost', 'Hidden', 'Frozen', 'Solar',
]

const nouns = [
  'Fox', 'Wolf', 'Raven', 'Hawk', 'Dragon', 'Tiger',
  'Panda', 'Cat', 'Bear', 'Eagle', 'Shark', 'Phoenix',
  'Viper', 'Cobra', 'Lynx', 'Owl', 'Crow', 'Falcon',
]

const avatars = [
  '🦊', '🐺', '🐼', '🦅', '🐉', '🦁', '🐯', '🌙',
  '⚡', '🔥', '❄️', '🌊', '👾', '🤖', '🎭', '🦋',
  '🐦', '🦚', '🐸', '🦝',
]

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

export function generateNickname(): string {
  const num = Math.floor(1000 + Math.random() * 9000)
  return `${pick(adjectives)} ${pick(nouns)} #${num}`
}

export function generateAvatar(): string {
  return pick(avatars)
}
