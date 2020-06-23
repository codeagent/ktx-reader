export default `#version 300 es
precision highp float;

layout( location = 0 ) out vec4 color;	

in vec3 _normal;
in vec3 _pos;
in vec3 _tangent;
in vec3 _bitangent;
in vec2 _uv;

uniform float exposure;
uniform float gamma;

uniform vec3 matAlbedo;
uniform float matMetallic;
uniform float matReflectance;
uniform float matRoughness;

uniform sampler2D matAlbedoMap;
uniform sampler2D matAoMap;
uniform sampler2D matMetallicMap;
uniform sampler2D matNormalMap;
uniform sampler2D matRouhnessMap;

uniform sampler2D dfgLut;
uniform samplerCube prefilteredEnvMap;
uniform vec3 pos;
uniform vec3 sphericalHarmonics[9];

vec3 gammaEncode(const vec3 color) {
  return pow(color, vec3(1.0f / gamma));
}

vec3 toneMapping(const vec3 color) {
  return vec3(1.0f) - exp(-color * exposure);
}

vec3 gammaDecode(const vec3 color) {
  return pow(color, vec3(gamma));
}

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

void main()
{
  mat3 tbn = mat3(normalize(_tangent), normalize(_bitangent), normalize(_normal));
  vec3 normal = texture(matNormalMap, _uv).rgb * 2.0f - 1.0f;
  vec3 albedo = gammaDecode(texture(matAlbedoMap, _uv).rgb * matAlbedo);
  float ao = texture(matAoMap, _uv).r;
  float metallic = texture(matMetallicMap, _uv).r * matMetallic;
  float roughness = texture(matRouhnessMap, _uv).r * matRoughness;
  normal = tbn * normal;
    
  vec3 f0 = 0.16 * matReflectance * matReflectance * (1.0 - metallic) + albedo * metallic;
  vec3 f90 = vec3(1.0f);

  vec3 n = normalize(normal);
  vec3 v = normalize(pos - _pos);

  vec3 lighting = ibl(n, v,  (1.0 - metallic) * albedo , f0, f90, roughness);
  color = vec4(gammaEncode(toneMapping(lighting * ao)), 1.0f);
}

`;
