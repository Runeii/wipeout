import { Color } from "three";

export const int32ToColor = function (v) {
	return new Color(((v >> 24) & 0xff) / 0x80, ((v >> 16) & 0xff) / 0x80, ((v >> 8) & 0xff) / 0x80);
};