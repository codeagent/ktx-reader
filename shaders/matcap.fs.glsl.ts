export default `#version 300 es
precision highp float;

layout( location = 0 ) out vec4 color;	

in vec3 _normal;
in vec3 _pos;
in vec3 _tangent;
in vec3 _bitangent;
in vec2 _uv;

uniform sampler2D matNormalMap;
uniform samplerCube prefilteredEnvMap;
uniform vec3 pos;

#define gamma 2.2f
#define exposure 2.0f

vec3 gammaEncode(const vec3 color) {
  return pow(color, vec3(1.0f / gamma));
}

vec3 toneMapping(const vec3 color) {
  return vec3(1.0f) - exp(-color * exposure);
}

vec3 colorCorrection(const vec3 color) {
  return toneMapping(gammaEncode(color));
}


void main()
{
  mat3 tbn = mat3(normalize(_tangent), normalize(_bitangent), normalize(_normal));
  vec3 normal = texture(matNormalMap, _uv).rgb * 2.0f - 1.0f;
  normal = tbn * normal;
  vec3 v = normalize(pos - _pos);
  vec3 r = reflect(-v, normal);
    
  color = vec4(colorCorrection(textureLod(prefilteredEnvMap, r, 2.0f).rgb), 1.0f);
}

`;
