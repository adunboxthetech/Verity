import json
import struct
import unittest
import zlib
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
ICON_SIZES = (16, 32, 48, 128)


def read_rgba_png(path):
    data = path.read_bytes()
    if data[:8] != b"\x89PNG\r\n\x1a\n":
        raise ValueError(f"{path} is not a PNG")

    offset = 8
    width = height = bit_depth = color_type = None
    compressed = b""
    while offset < len(data):
        length = struct.unpack(">I", data[offset:offset + 4])[0]
        chunk_type = data[offset + 4:offset + 8]
        chunk = data[offset + 8:offset + 8 + length]
        offset += 12 + length
        if chunk_type == b"IHDR":
            width, height, bit_depth, color_type, _compression, _filter, interlace = struct.unpack(
                ">IIBBBBB", chunk
            )
            if bit_depth != 8 or color_type != 6 or interlace != 0:
                raise ValueError(f"{path} must be a non-interlaced 8-bit RGBA PNG")
        elif chunk_type == b"IDAT":
            compressed += chunk
        elif chunk_type == b"IEND":
            break

    stride = width * 4
    raw = zlib.decompress(compressed)
    rows = []
    previous = [0] * stride
    cursor = 0
    for _ in range(height):
        filter_type = raw[cursor]
        cursor += 1
        scanline = list(raw[cursor:cursor + stride])
        cursor += stride
        row = [0] * stride
        for index, value in enumerate(scanline):
            left = row[index - 4] if index >= 4 else 0
            up = previous[index]
            up_left = previous[index - 4] if index >= 4 else 0
            if filter_type == 0:
                row[index] = value
            elif filter_type == 1:
                row[index] = (value + left) & 255
            elif filter_type == 2:
                row[index] = (value + up) & 255
            elif filter_type == 3:
                row[index] = (value + ((left + up) // 2)) & 255
            elif filter_type == 4:
                predictor = left + up - up_left
                distances = (abs(predictor - left), abs(predictor - up), abs(predictor - up_left))
                paeth = left if distances[0] <= distances[1] and distances[0] <= distances[2] else up if distances[1] <= distances[2] else up_left
                row[index] = (value + paeth) & 255
            else:
                raise ValueError(f"unsupported PNG filter {filter_type}")
        rows.append(row)
        previous = row

    return width, height, rows


class ExtensionIconAssetTests(unittest.TestCase):
    def test_action_defaults_to_black_icon_for_light_pages(self):
        manifest = json.loads((ROOT / "extension" / "manifest.json").read_text())

        self.assertEqual(
            manifest["action"]["default_icon"],
            {str(size): f"icons/icon{size}-black.png" for size in ICON_SIZES},
        )

    def test_extension_icons_are_transparent_black_and_white_variants(self):
        for size in ICON_SIZES:
            with self.subTest(size=size):
                black_path = ROOT / "extension" / "icons" / f"icon{size}-black.png"
                white_path = ROOT / "extension" / "icons" / f"icon{size}.png"

                for path, expected_rgb in ((black_path, (0, 0, 0)), (white_path, (255, 255, 255))):
                    width, height, rows = read_rgba_png(path)
                    self.assertEqual((width, height), (size, size))

                    corner_alpha = rows[0][3]
                    self.assertEqual(corner_alpha, 0, f"{path} should not have a baked-in square background")

                    opaque_pixels = []
                    for row in rows:
                        for index in range(0, len(row), 4):
                            if row[index + 3] >= 128:
                                opaque_pixels.append(tuple(row[index:index + 3]))

                    self.assertGreater(len(opaque_pixels), 0)
                    self.assertTrue(
                        all(pixel == expected_rgb for pixel in opaque_pixels),
                        f"{path} should use only {expected_rgb} for visible logo pixels",
                    )

    def test_background_switches_white_icon_for_dark_pages_and_black_for_light_pages(self):
        background_js = (ROOT / "extension" / "background.js").read_text()

        self.assertIn('const suffix = isDark ? "" : "-black"', background_js)
        self.assertIn("PAGE_THEME_DETECTED", background_js)


if __name__ == "__main__":
    unittest.main()
