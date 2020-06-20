export default `#version 300 es
precision highp float;

#define PI 3.14159265f
#define NUM_SAMPLES 512u
#define EPS 1.0e-4

layout( location = 0 ) out vec4 color;	

in vec3 _normal;
in vec3 _pos;

uniform samplerCube env;
uniform vec3 pos;
uniform vec3 sphericalHarmonics[9];

vec3 irradianceSH(vec3 n);
mat3 createSpecularBasis(vec3 r);
vec3 createSampleVector(uint i, uint n, float roughness);


float chiGGX(float v);
float ggxDistribution(vec3 n, vec3 h, float alpha);
float ggxPartialGeometry(vec3 v, vec3 n, float alpha);
float ggxGeometry(vec3 v, vec3 l, vec3 n, float alpha);
vec3 fresnelSchlick(float cosT, vec3 F0);
float radicalInverse_VdC(uint bits);
vec2 hammersley2d(uint i, uint N);

void main()
{
  float roughness = 0.25f;
  float reflectance = 1.0f;
  float metallic = 0.95f;
  vec3 albedo = vec3(1.0f, 1.0f, 1.0f);

  vec3 F0 = 0.16f * reflectance * reflectance * (1.0f - metallic) + albedo * metallic;

// roughness = sqrt(roughness);
  vec3 n = normalize(_normal);
  vec3 v = normalize(pos - _pos);
  vec3 r = reflect(-v, n);


  // Calc specular
  mat3 basis = createSpecularBasis(r);
  vec3 radiance = vec3(0.0f);
  float NoV = dot(n, v);
  vec3 ks = vec3(0.0f);

  for(uint i = 0u; i < NUM_SAMPLES; i++) {
    vec3 s = normalize(basis * createSampleVector(i, NUM_SAMPLES, roughness));
    float cosT = dot(s, n);
    float sinT = sqrt(1.0f - cosT * cosT);
    vec3 h = normalize(v + s);
    float HoV = max(dot(h, v), 0.0f);
    float HoN = max(dot(h, n), 0.0f);
    vec3 F = fresnelSchlick(HoV, F0);
    float G = ggxGeometry(v, s, n, roughness);
    float denom = 4.0f * NoV * HoN;
    ks += F;
    // radiance += textureLod(env, s, 0.0f).rgb * G * F * sinT / denom;
    radiance += textureLod(env, s, 0.0f).rgb;
  }

  ks /= float(NUM_SAMPLES);
  radiance /= float(NUM_SAMPLES);

  vec3 kd = (1.0f - ks) * (1.0f - metallic);
  color = vec4(vec3(kd * albedo * irradianceSH(n) + radiance), 1.0f);
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



float chiGGX(float v)
{
  // return 1.0f;
    return v > 0.0f ? 1.0f : 0.0f;
}

float ggxDistribution(vec3 n, vec3 h, float alpha)
{
    float NoH = dot(n,h);
    float alpha2 = alpha * alpha;
    float NoH2 = NoH * NoH;
    float den = NoH2 * alpha2 + (1.0f - NoH2);
    return (chiGGX(NoH) * alpha2) / ( PI * den * den );
}

float ggxPartialGeometry(vec3 v, vec3 n, float alpha)
{
    float VoN = dot(v, n);
    float alpha2 = alpha * alpha;
    float VoN2 = VoN * VoN;
    return (VoN * 2.0f) / ( VoN + sqrt(alpha2  + (1.0f - alpha2) * VoN2 ) );
}

float ggxGeometry(vec3 v, vec3 l, vec3 n, float alpha)
{
  return ggxPartialGeometry(v, n, alpha) * ggxPartialGeometry(l, n, alpha);
}

vec3 fresnelSchlick(float cosT, vec3 F0)
{
  return F0 + (1.0f-F0) * pow( 1.0f - cosT, 5.0f);
}

mat3 createSpecularBasis(vec3 r) {
  vec3 x;
  if(abs(r.x) < EPS) {
    x = vec3(0.0f, -r.z, r.y);
  } else {
    x = vec3(-r.z, 0.0f, r.x);
  }
  vec3 y = cross(r, x);
  return mat3(normalize(x), normalize(y), r);
}

float radicalInverse_VdC(uint bits) {
  bits = (bits << 16u) | (bits >> 16u);
  bits = ((bits & 0x55555555u) << 1u) | ((bits & 0xAAAAAAAAu) >> 1u);
  bits = ((bits & 0x33333333u) << 2u) | ((bits & 0xCCCCCCCCu) >> 2u);
  bits = ((bits & 0x0F0F0F0Fu) << 4u) | ((bits & 0xF0F0F0F0u) >> 4u);
  bits = ((bits & 0x00FF00FFu) << 8u) | ((bits & 0xFF00FF00u) >> 8u);
  return float(bits) * 2.3283064365386963e-10; // / 0x100000000
}

vec2 hammersley2d(uint i, uint N) {
    return vec2(float(i)/float(N), radicalInverse_VdC(i));
}

vec3 createSampleVector(uint i, uint n, float roughness) {
  vec2 e = hammersley2d(i, n);
  float teta = atan(roughness * sqrt(e[1])/  sqrt(1.0f - e[1]));
  float phi = 2.0f * PI * e[0];
  float sinTeta = sin(teta);
  return vec3(cos(phi) * sinTeta, sin(phi) * sinTeta, cos(teta));
}


`;