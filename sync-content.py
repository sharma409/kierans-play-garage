"""Regenerate the browser data and simple list after editing dist/content.json."""
import html
import json
import math
import re
from pathlib import Path
from urllib.parse import urlsplit


def require(condition, message):
    if not condition:
        raise ValueError(message)


def number(value):
    return isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value)


def normalized_point(value, label):
    require(isinstance(value, list) and len(value) == 2, f'{label} must contain two coordinates.')
    require(all(number(v) and 0 <= v <= 1 for v in value), f'{label} must lie within the normalized image.')


def bounds(value, label):
    require(isinstance(value, list) and len(value) == 4, f'{label} must be [left, top, width, height].')
    require(all(number(v) for v in value), f'{label} must contain finite numbers.')
    x, y, w, h = value
    require(0 <= x < 1 and 0 <= y < 1 and w > 0 and h > 0
            and x + w <= 1 + 1e-9 and y + h <= 1 + 1e-9,
            f'{label} must have positive size and stay inside the normalized image.')


def asset(root, value, label):
    require(isinstance(value, str) and bool(value), f'{label} needs a local asset path.')
    path = (root / value).resolve()
    require(not Path(value).is_absolute() and path.is_relative_to(root.resolve()),
            f'{label} must be relative to dist and stay inside it.')
    require(path.is_file(), f'Missing {label}: {value}')


def unique_ids(records, label, key='id'):
    require(isinstance(records, list) and bool(records), f'{label} must be a nonempty list.')
    values = [record.get(key) for record in records]
    require(all(isinstance(value, str) and bool(value) for value in values), f'Each {label} needs a {key}.')
    require(len(values) == len(set(values)), f'{label} {key} values must be unique.')
    return values


def validate(data, root):
    ids = unique_ids(data['items'], 'Gift')
    chapter_ids = unique_ids(data['chapters'], 'Chapter')
    unique_ids(data['chapters'], 'Chapter', 'anchor')
    unique_ids(data['hotspots'], 'Physical region')
    scene = data['scene']
    for dimension in ('width', 'height'):
        require(isinstance(scene.get(dimension), int) and not isinstance(scene[dimension], bool)
                and scene[dimension] > 0, f'Scene {dimension} must be a positive integer.')
    for key in ('image', 'frontOpen', 'frontClosed'):
        asset(root, scene.get(key), f'scene {key}')
    bounds(scene.get('doorBounds'), 'Scene doorBounds')
    if 'mobileRoute' in scene:
        route = scene['mobileRoute']
        shown = {item for chapter in data['chapters'] for item in chapter.get('items', [])}
        require(isinstance(route, list) and all(isinstance(item, str) and item in shown for item in route)
                and len(route) == len(set(route)), 'Scene mobileRoute must contain unique displayed gift IDs.')

    for item in data['items']:
        label = f'Gift {item["id"]}'
        asset(root, item.get('image'), f'{label} image')
        if 'imageCrop' in item:
            bounds(item['imageCrop'], f'{label} imageCrop')
        url = item.get('exampleURL', '')
        require(isinstance(url, str), f'{label} exampleURL must be a string or empty.')
        if url:
            parsed = urlsplit(url)
            require(parsed.scheme in ('https', 'http') and bool(parsed.netloc)
                    and not any(c.isspace() for c in url), f'{label} has an invalid exampleURL.')

    regions = {point['id']: point for point in data['hotspots']}
    for point in data['hotspots']:
        label = f'Region {point["id"]}'
        require(point.get('item') in ids, f'{label} references an unknown gift.')
        membership = point.get('chapters')
        require(isinstance(membership, list) and bool(membership)
                and all(ch in chapter_ids for ch in membership)
                and len(membership) == len(set(membership)), f'{label} has invalid chapter membership.')
        normalized_point([point.get('x'), point.get('y')], f'{label} leader anchor')
        bounds(point.get('bounds'), f'{label} bounds')
        x, y, w, h = point['bounds']
        require(x - 1e-9 <= point['x'] <= x + w + 1e-9
                and y - 1e-9 <= point['y'] <= y + h + 1e-9,
                f'{label} leader anchor must be inside its region bounds.')
        if 'mobileAnchor' in point:
            normalized_point(point['mobileAnchor'], f'{label} mobileAnchor')
            mx, my = point['mobileAnchor']
            require(x <= mx <= x + w and y <= my <= y + h,
                    f'{label} mobileAnchor must be inside its region bounds.')
        if 'detailBounds' in point:
            bounds(point['detailBounds'], f'{label} detailBounds')
        for kind in ('polygons', 'holes'):
            outlines = point.get(kind, [])
            require(isinstance(outlines, list), f'{label} {kind} must be a list.')
            for index, outline in enumerate(outlines):
                require(isinstance(outline, list) and len(outline) >= 3,
                        f'{label} {kind}[{index}] needs at least three vertices.')
                for vertex in outline:
                    normalized_point(vertex, f'{label} {kind}[{index}] vertex')
        require(not point.get('holes') or point.get('polygons'), f'{label} holes require an outer polygon.')
        require(not point.get('image'), f'{label} must use the shared room image, not a separate cutout.')

    for chapter in data['chapters']:
        label = f'Chapter {chapter["id"]}'
        members = chapter.get('items')
        require(isinstance(members, list) and bool(members)
                and all(item_id in ids for item_id in members)
                and len(members) == len(set(members)), f'{label} has unknown or repeated gifts.')
        targets = chapter.get('targets')
        require(isinstance(targets, dict) and set(targets) == set(members),
                f'{label} needs exactly one explicit target for every displayed gift.')
        for item_id, region_id in targets.items():
            require(isinstance(region_id, str) and region_id in regions,
                    f'{label} target for {item_id} references an unknown physical region.')
            point = regions[region_id]
            require(point['item'] == item_id and chapter['id'] in point['chapters'],
                    f'{label} target {region_id} must belong to gift {item_id} and this chapter.')
        for key in ('focus', 'mobileFocus'):
            if key in chapter:
                normalized_point(chapter[key], f'{label} {key}')
        for key in ('zoom', 'mobileZoom'):
            if key in chapter:
                require(number(chapter[key]) and chapter[key] > 0, f'{label} {key} must be positive and finite.')
    return ids


def synchronize(root):
    data = json.loads((root / 'content.json').read_text())
    ids = validate(data, root)
    (root / 'content.js').write_text('window.GARAGE_CONTENT = ' + json.dumps(data,ensure_ascii=False,separators=(',',':')).replace('<','\\u003c') + ';\n')
    simple = (root / 'gift-ideas.html').read_text()
    simple = re.sub(r'\b\d+ ideas', f'{len(ids)} ideas', simple)
    start = simple.index('<article>')
    end = simple.rindex('</article>') + len('</article>')
    cards = []
    for item in data['items']:
        url = item.get('exampleURL', '')
        link_label = 'See an example'
        link = f'<a href="{html.escape(url,quote=True)}" target="_blank" rel="noopener noreferrer">{link_label}</a>' if url else ''
        picture = f'<img loading="lazy" src="{html.escape(item["image"],quote=True)}" alt="{html.escape(item["name"],quote=True)}">'
        if item.get('imageCrop'):
            x,y,w,h=item['imageCrop'];ratio=data['scene']['width']/data['scene']['height']*w/h
            picture=f'<div class="picture-cell"><div class="scene-crop" style="aspect-ratio:{ratio}"><img src="{html.escape(data["scene"]["image"],quote=True)}" alt="{html.escape(item["name"],quote=True)} — room concept" style="left:{-100*x/w}%;top:{-100*y/h}%;width:{100/w}%;height:{100/h}%"></div></div>'
        cards.append(f'<article>{picture}<div><h2>{html.escape(item["name"])}</h2><p>{html.escape(item["description"])}</p>{link}</div></article>')
    (root / 'gift-ideas.html').write_text(simple[:start] + ''.join(cards) + simple[end:])
    index = root / 'index.html'
    markup = index.read_text()
    markup = re.sub(r'(<[^>]+\bdata-count(?=[\s=>])[^>]*>)(\s*)\d+(\s*)(</[^>]+>)',
                    lambda match: f'{match[1]}{match[2]}{len(ids)}{match[3]}{match[4]}', markup)
    index.write_text(markup)
    print(f'Validated and synchronized {len(ids)} gift ideas, {len(data["chapters"])} groups, and {len(data["hotspots"])} physical regions.')


if __name__ == '__main__':
    synchronize(Path(__file__).resolve().parent / 'dist')
