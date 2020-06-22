export default `#version 300 es
precision highp float;

layout( location = 0 ) out vec4 color;	

in vec3 _normal;
in vec3 _pos;
in vec4 _tangent;
in vec2 _uv;

uniform float exposure;
uniform float gamma;

uniform vec3 matAlbedo;
uniform float matMetallic;
uniform float matReflectance;
uniform float matRoughness;

uniform sampler2D dfgLut;
uniform samplerCube prefilteredEnvMap;
uniform vec3 pos;
uniform vec3 sphericalHarmonics[9];

vec3 irradianceSH(vec3 n) {
    // uniform vec3 sphericalHarmonics[9]
    // We can use only the first 2 bands for better performance
    return
          sphericalHarmonics[0]
        + sphericalHarmonics[1] * (n.y)
        + sphericalHarmonics[2] * (n.z)
        + sphericalHarmonics[3] * (n.x)
        + sphericalHarmonics[4] * (n.y * n.x)
        + sphericalHarmonics[5] * (n.y * n.z)
        + sphericalHarmonics[6] * (3.0 * n.z * n.z - 1.0)
        + sphericalHarmonics[7] * (n.z * n.x)
        + sphericalHarmonics[8] * (n.x * n.x - n.y * n.y);
}

float computeLODFromRoughness(const float perceptualRoughness) {
  return 4.0f * perceptualRoughness;
}

vec3 ibl(vec3 n, vec3 v, vec3 diffuseColor, vec3 f0, vec3 f90, float perceptualRoughness) {
    vec3 r = reflect(-v, n);
    vec3 Ld = irradianceSH(n) * diffuseColor;
    float lod = computeLODFromRoughness(perceptualRoughness);
    vec3 Lld = textureLod(prefilteredEnvMap, r, lod).rgb;
    vec2 Ldfg = textureLod(dfgLut, vec2(dot(n, v), perceptualRoughness), 0.0).xy;
    vec3 Lr =  (f0 * Ldfg.x + f90 * Ldfg.y) * Lld;
    return Ld + Lr;
}

vec3 gammaCorrection(const vec3 color) {
  return pow(color, vec3(1.0f / gamma));
}

vec3 toneMapping(const vec3 color) {
  return vec3(1.0f) - exp(-color * exposure);
}

void main()
{
  color = vec4(_tangent.rgb * 0.5f + 0.5f, 1.0f);
  // color = vec4(_uv.x, _uv.y, 0.f, 1.0f);
  return;
  vec3 f0 = 0.16 * matReflectance * matReflectance * (1.0 - matMetallic) + matAlbedo * matMetallic;
  vec3 f90 = vec3(1.0f);

  vec3 n = normalize(_normal);
  vec3 v = normalize(pos - _pos);

  vec3 lighting = ibl(n, v,  (1.0 - matMetallic) * matAlbedo , f0, f90, matRoughness);
  color = vec4(gammaCorrection(toneMapping(lighting)), 1.0f);
}




`;
