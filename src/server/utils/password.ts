const encoder = new TextEncoder();

async function deriveKey(
	password: string,
	salt: Uint8Array,
): Promise<ArrayBuffer> {
	const keyMaterial = await crypto.subtle.importKey(
		'raw',
		encoder.encode(password),
		'PBKDF2',
		false,
		['deriveBits'],
	);

	return crypto.subtle.deriveBits(
		{
			name: 'PBKDF2',
			salt: salt as ArrayBufferView<ArrayBuffer>,
			iterations: 100000,
			hash: 'SHA-256',
		},
		keyMaterial,
		256,
	);
}

export async function hashPassword(password: string): Promise<string> {
	const salt = crypto.getRandomValues(new Uint8Array(16));
	const hash = await deriveKey(password, salt);

	const saltHex = Array.from(salt)
		.map((b) => b.toString(16).padStart(2, '0'))
		.join('');
	const hashHex = Array.from(new Uint8Array(hash))
		.map((b) => b.toString(16).padStart(2, '0'))
		.join('');

	return `${saltHex}:${hashHex}`;
}

export async function verifyPassword(
	password: string,
	storedHash: string,
): Promise<boolean> {
	const [saltHex, hashHex] = storedHash.split(':') as [string, string];

	const matches = saltHex.match(/.{2}/g) ?? [];
	const salt = new Uint8Array(matches.map((byte) => Number.parseInt(byte, 16)));

	const hash = await deriveKey(password, salt);
	const computedHashHex = Array.from(new Uint8Array(hash))
		.map((b) => b.toString(16).padStart(2, '0'))
		.join('');

	return computedHashHex === hashHex;
}
