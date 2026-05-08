import urllib.request
import json

data = {
    'nombre': 'Prueba Pixel',
    'telefono': '7710000000',
    'correo': 'prueba@pixel.com',
    'empresa': 'Prueba',
    'fuente': 'test',
    'notas': 'Prueba de transmision y eventos'
}

json_data = json.dumps(data).encode('utf-8')

req = urllib.request.Request(
    'https://hook.us2.make.com/2anfzn9sboljlw56hfubeby78sl1pwcw',
    data=json_data,
    headers={'Content-Type': 'application/json'}
)

try:
    response = urllib.request.urlopen(req)
    print('Webhook responde correctamente')
    print('Status Code:', response.getcode())
    print('Response:', response.read().decode())
except Exception as e:
    print('Error en webhook:', e)