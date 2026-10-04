"""Creates (or updates) the "Ask Hiro" widget in a widget studio.

Usage: python3 provision_hiro.py <studio base> <admin email> <admin password> <engine url> <engine app key> [widget id]

Uploads the orb and card icons, saves the Hiro design as the widget's studio-owned
(Redis) config, and points the widget's chat at the Hiro agent on the given
Danah instance. Safe to run again: it updates in place.
"""
import json
import os
import sys
import urllib.error
import urllib.request

base, email, password, engine_url, engine_key = sys.argv[1:6]
WID = sys.argv[6] if len(sys.argv) > 6 else 'HIRO_ASK'
HERE = os.path.dirname(os.path.abspath(__file__))


def call(method, path, body=None, tok=None, raw=None, ctype='application/json'):
    data = raw if raw is not None else (json.dumps(body).encode() if body is not None else None)
    h = {'content-type': ctype}
    if tok:
        h['authorization'] = 'Bearer ' + tok
    r = urllib.request.Request(base + path, method=method, data=data, headers=h)
    try:
        with urllib.request.urlopen(r, timeout=30) as res:
            out = res.read()
            return json.loads(out) if out else None
    except urllib.error.HTTPError as e:
        raise RuntimeError(f'{method} {path} -> {e.code}: {e.read()[:300]!r}')


tok = call('POST', '/api/auth/login', {'email': email, 'password': password})['token']


def upload(name):
    with open(os.path.join(HERE, 'assets', name), 'rb') as f:
        return call('POST', '/api/uploads', raw=f.read(), tok=tok, ctype='image/svg+xml')['url']


orb, flame, chart, bolt = (upload(n) for n in ('hiro-orb.svg', 'icon-flame.svg', 'icon-chart.svg', 'icon-bolt.svg'))
print('uploaded:', orb, flame, chart, bolt)

FONT = '"Barlow Semi Condensed", "Barlow", system-ui, sans-serif'
NAVY = '#0B2545'
MUTED = '#5B6B82'
BLUE = '#218EE7'  # Hiro's blue

config = {
    'widget_id': WID,
    'name': 'Hiro',
    'business_name': 'Hiro',
    'locale': 'en',
    'widget_color': BLUE,
    'welcome_title': "Hi, I'm Hiro",
    'welcome_tagline': 'Your personal health companion. Ask me anything about your body metrics, nutrition, or fitness.',
    'reply_time': 'in_a_few_minutes',
    'avatar_url': '',
    'widget_header': True,
    'powered_by_pair_ai': False,
    'pre_chat_form_enabled': False,
    'enable_greeting': False,
    # The app identifies the user: these metadata keys travel with every
    # message, and reach the agent as its inputs (phone → body scans).
    'params': {'phone': 'phone', 'user_id': 'user_id', 'name': 'name', 'profile_id': 'profile_id'},
    'headers': {},
    'styles': {'fontFamily': FONT},
    # In the app the screen is the chat: no launcher, always open.
    'launcher_design': {'type': 'none', 'position': 'right'},
    'launcher_title': 'Ask Hiro',
    'widget_v2_config': {
        'header': {
            'enabled': True,
            'showIcon': False,
            'icon': None,
            'background': {'enabled': False, 'color': ''},
            'content': {'title': 'ASK HIRO', 'title_i18n': {'en': 'ASK HIRO', 'ar': 'اسأل هيرو'}, 'subtitle': ''},
            'titleStyle': {'color': NAVY, 'fontSize': '1.45rem', 'fontWeight': 700, 'fontFamily': FONT, 'letterSpacing': '0.02em'},
            'subtitleStyle': {'color': MUTED, 'fontSize': '0.8rem'},
            'iconStyle': {'shape': 'circle'},
            'actions': {'cart': False, 'favorites': False, 'reset': False},
            # عربي / EN, light / dark and close on the header. Close tells the app
            # (PairWidget.on('close')), which leaves the Ask Hiro screen.
            'controls': {'lang': {'show': True, 'icon': 'badge'}, 'theme': {'show': True, 'icon': 'moon'}, 'close': {'show': True}},
        },
        'intro_screen': {
            'showIntroScreen': {'value': True, 'styles': {}},
            'showPattern': False,
            'introTitle': {'text': '', 'styles': {}},
            'widgetBackground': {'type': 'gradient', 'background': 'linear-gradient(180deg, #F7F8FB 0%, #EEF1F7 100%)'},
            'heroSection': {
                'enabled': {'value': True, 'styles': {}},
                # One plain image: the studio passes it through untouched, so the
                # orb sits on the screen's own background with the welcome below.
                'heroImage': {'url': orb, 'position': 'top', 'styles': {'width': '100%', 'height': '230px', 'objectFit': 'contain', 'background': 'transparent'}},
            },
            'welcomeTitle': {
                'text': "Hi, I'm Hiro",
                'i18n': {'en': "Hi, I'm Hiro", 'ar': 'أهلاً، أنا هيرو'},
                'styles': {'color': NAVY, 'fontSize': '1.4rem', 'fontWeight': 700, 'textAlign': 'center', 'fontFamily': FONT},
            },
            'welcomeSubtitle': {
                'text': 'Your personal health companion. Ask me anything about your body metrics, nutrition, or fitness.',
                'i18n': {
                    'en': 'Your personal health companion. Ask me anything about your body metrics, nutrition, or fitness.',
                    'ar': 'رفيقك الصحي الشخصي. اسألني أي شي عن قياسات جسمك، التغذية، أو اللياقة.',
                },
                'styles': {'color': MUTED, 'fontSize': '0.95rem', 'fontWeight': 400, 'textAlign': 'center', 'fontFamily': FONT, 'lineHeight': '1.35'},
            },
            'loadingState': {'type': 'shimmer', 'styles': {}},
        },
        'quick_links': {
            'showQuickLinks': {'value': True},
            'showTitle': True,
            'showSubtitle': False,
            'displaySettings': {'position': 'under_welcome', 'carouselLoop': False, 'sectionTitle': ''},
            'quickLinkCards': [
                {'id': 'hiro-burn-fat', 'order': 1, 'active': True, 'url': flame, 'title': 'Best way to burn fat?', 'subtitle': '', 'message': 'What is the best way for me to burn fat?', 'i18n': {'ar': {'title': 'أفضل طريقة أحرق دهون؟', 'message': 'شنو أفضل طريقة أحرق فيها دهون؟'}}},
                {'id': 'hiro-weight', 'order': 2, 'active': True, 'url': chart, 'title': 'Is my weight improving?', 'subtitle': '', 'message': 'Is my weight improving?', 'i18n': {'ar': {'title': 'هل وزني يتحسن؟', 'message': 'هل وزني قاعد يتحسن؟'}}},
                {'id': 'hiro-muscle', 'order': 3, 'active': True, 'url': bolt, 'title': 'How to gain muscle?', 'subtitle': '', 'message': 'How do I gain muscle?', 'i18n': {'ar': {'title': 'كيف أبني عضل؟', 'message': 'كيف أبني عضل؟'}}},
            ],
            'design': {
                'layout': 'carousel', 'gap': 10, 'cardWidth': 112, 'autoScroll': False,
                'background': '#FFFFFF', 'borderColor': '#FFFFFF', 'borderWidth': 0, 'radius': 22, 'padding': 14,
                'shadow': {'size': 18, 'y': 6, 'blur': 22, 'color': '#1E3A6E', 'opacity': 0.08},
                'showImage': True, 'imageAsIcon': True, 'iconSize': 26, 'imageHeight': 26, 'imageFit': 'contain',
                'align': 'start', 'titleColor': NAVY, 'titleSize': 15, 'titleWeight': '500', 'fontFamily': FONT,
            },
        },
        'trending_prompts': {'showTrendingPrompts': {'value': False}, 'promptChips': [], 'displaySettings': {}},
        'chat_input': {
            'inputLayout': {'type': 'floating_pill'},
            'inputActions': {'stickers': False, 'fileUpload': False, 'voiceMessages': False, 'attachmentMenu': False},
            'placeholderText': {'text': 'Ask about your progress or goals', 'text_i18n': {'en': 'Ask about your progress or goals', 'ar': 'اسأل عن تقدمك أو أهدافك'}, 'styles': {'color': '#5E6B80', 'fontSize': '0.95rem', 'fontFamily': FONT}},
            'design': {
                'layout': 'floating_pill',
                'field': {'background': '#FFFFFF', 'borderWidth': 0, 'radius': 999, 'height': 56, 'paddingX': 20,
                          'shadow': {'size': 20, 'y': 8, 'blur': 26, 'color': '#1E3A6E', 'opacity': 0.09}},
                'text': {'color': NAVY, 'size': 15, 'fontFamily': FONT},
                'placeholder': {'color': '#5E6B80'},
                'send': {'shape': 'circle', 'size': 40, 'background': BLUE, 'iconColor': '#FFFFFF', 'position': 'inside'},
                'actions': {'voice': False, 'attach': False, 'emoji': False},
                'container': {'background': 'transparent', 'paddingX': 14, 'paddingTop': 10, 'paddingBottom': 18},
            },
            'sendButtonIcon': {'icon': 'paper-plane', 'variant': 'send', 'styles': {'backgroundColor': BLUE, 'iconColor': '#FFFFFF', 'borderRadius': '999px'}},
        },
        'messages': {
            'thinking': {'style': 'pill', 'label': 'Thinking', 'label_i18n': {'en': 'Thinking', 'ar': 'أفكر'}, 'from': '#8FD3FF', 'to': '#9AA8F5', 'height': 56},
            'feedback': {'showFeedbackButtons': False, 'toastMessage': 'Thanks for your feedback.'},
            'aiMessages': {'messageStyle': 'plain', 'showAiIcon': False,
                           'TextStyles': {'color': NAVY, 'fontSize': '0.98rem', 'fontFamily': FONT, 'fontWeight': '400'}},
            'customerMessages': {'bubbleType': 'filled', 'useBrandColor': False,
                                 'bubbleStyle': {'backgroundColor': '#FFFFFF', 'borderRadius': '1.25rem', 'boxShadow': '0 6px 18px rgba(30,58,110,0.08)', 'border': '1px solid #EEF1F6'},
                                 'TextStyles': {'color': NAVY, 'fontSize': '0.98rem', 'fontFamily': FONT}},
        },
    },
}

# The widget: studio-owned design, chat through the Hiro agent on Danah.
try:
    call('GET', f'/api/widgets/{WID}', tok=tok)
    exists = True
except RuntimeError:
    exists = False
fields = {'engine': 'agent-engine', 'agentId': 'hiro', 'engineKey': engine_key, 'engineUrl': engine_url}
if not exists:
    call('POST', '/api/widgets', {'widgetId': WID, 'channelName': 'Ask Hiro', 'source': 'api', 'importFromApi': False, **fields}, tok=tok)
call('PUT', f'/api/widgets/{WID}/config', config, tok=tok)
call('PATCH', f'/api/widgets/{WID}', {'source': 'redis', **fields}, tok=tok)
print('widget ready:', WID, '| created' if not exists else '| updated')
