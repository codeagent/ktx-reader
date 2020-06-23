export default `#version 300 es
precision highp float;

layout( location = 0 ) out vec4 color;	

in vec2 _uv;

uniform vec3 matAlbedo;
uniform sampler2D matAlbedoMap;

void main()
{   
  vec3 albedo = texture(matAlbedoMap, _uv).rgb * matAlbedo;
  color = vec4(vec3(albedo), 1.0f);
}
`;
